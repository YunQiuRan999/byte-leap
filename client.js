/**
 * Byte Leap — browser half.
 *
 * Registers the sidebar icon, the demo panel, and the global stylesheet that
 * animates streaming replies. The panel is self-contained: it does not read
 * session data, and nothing is added to the conversation.
 */window.__ModuleLoader__.load({
  id: '@local/byte-leap',
  factory(require) {
    'use strict';
    const React = require('react');
    const h = React.createElement;
    const useCallback = React.useCallback;
    const useEffect = React.useEffect;
    const useLayoutEffect = React.useLayoutEffect;
    const useRef = React.useRef;
    const useState = React.useState;

    /** Client locale namespace owned by this package. */
    const NS = 'byte-leap';
    /** The sidebar panel id; also the `main` slot key. */
    const PANEL_ID = 'byte-leap';

    /** Simplified Chinese copy: the key-set source of truth. */
    const zh = {
      'panel.title': '词元跃迁',
      'panel.subtitle': '思考时，词元一个一个跳出来。下面是一段示例。',
      'panel.badge': '毛玻璃 · 轻动效',
      'stage.label': '示例',
      'action.replay': '重播',
      'stat.words': '累计 {words} 个词元',
      'stat.rate': '每秒 {rate} 个词元',
      'opt.title': '动画',
      'opt.line1': '每个词只入场一次：从下方 10px、缩到 0.72，再弹回原位。只动位置、大小和透明度。',
      'opt.line2': '一次补 1–2 个词，掉帧不追；词太多时丢掉最早的一批，画面不跳。',
      'opt.line3': '系统开了“减少动态效果”时，直接显示整段文字。',
      'mat.title': '玻璃',
      'mat.line1': '底色用主题的层级色，混一点灰；明暗主题都接得上。',
      'mat.line2': '0.5px 高光边、细噪点、30px 背景模糊；蓝色只留在图标和圆点上。',
      'mat.line3': '文字用中性深灰，先保证读得清。',
      'demo':
        '先看现在的效果。词一个一个出来，节奏别太急。右边别把新词淡掉，得看得清。颜色收成灰，玻璃亮一点没关系，字得压得住。跑一遍，快了就慢点，乱了就少动点。',
    };

    /** English copy with the same keys. */
    const en = {
      'panel.title': 'Token Leap',
      'panel.subtitle': 'Thinking tokens arrive one at a time. Here’s a short sample.',
      'panel.badge': 'Frosted glass · light motion',
      'stage.label': 'Sample',
      'action.replay': 'Replay',
      'stat.words': '{words} tokens',
      'stat.rate': '{rate} tokens/sec',
      'opt.title': 'Motion',
      'opt.line1': 'Each word enters once: 10px down at 0.72 scale, then back into place. Position, scale and opacity only.',
      'opt.line2': 'One or two words per tick, no catch-up after a dropped frame. Old words are trimmed in batches so the ribbon doesn’t jump.',
      'opt.line3': 'With reduced motion on, the whole sample appears at once.',
      'mat.title': 'Glass',
      'mat.line1': 'The tint starts from the theme layer colors plus a little gray, so light and dark both connect.',
      'mat.line2': 'A 0.5px highlight edge, fine noise, 30px of backdrop blur. Blue stays on the icon and the badge dot.',
      'mat.line3': 'Text is neutral gray. Readability comes first.',
      'demo':
        'Start with the current build. Words arrive one at a time; keep the pace calm. Don’t let the right-edge fade swallow the newest word. Pull the palette to gray; the glass can be bright, but the text has to hold. Run it once. Too fast, slow it down; too busy, take something out.',
    };

    /** Long streams trim themselves in batches; the ticker compensates the jump. */
    const TRIM_AT = 260;
    const TRIM_KEEP = 160;

    const CJK_CHAR = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/;

    /** Split streamed text into readable word pieces (2 CJK chars, or Latin words). */
    function tokenizeWords(text) {
      const pieces = [];
      let latin = '';
      let cjk = '';
      const flushLatin = () => {
        if (latin !== '') {
          pieces.push(latin);
          latin = '';
        }
      };
      const flushCjk = () => {
        if (cjk !== '') {
          pieces.push(cjk);
          cjk = '';
        }
      };
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (/\s/.test(character)) {
          flushLatin();
          flushCjk();
          continue;
        }
        if (CJK_CHAR.test(character)) {
          flushLatin();
          cjk += character;
          if (cjk.length >= 2) {
            pieces.push(cjk);
            cjk = '';
          }
          continue;
        }
        flushCjk();
        latin += character;
        if (latin.length >= 12) {
          pieces.push(latin);
          latin = '';
        }
      }
      flushLatin();
      flushCjk();
      return pieces;
    }

    /** Subscribe to the OS reduced-motion preference. */
    function useReducedMotion() {
      const [reduced, setReduced] = useState(() => {
        try {
          return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (error) {
          return false;
        }
      });
      useEffect(() => {
        let query = null;
        try {
          query = window.matchMedia('(prefers-reduced-motion: reduce)');
        } catch (error) {
          return undefined;
        }
        const onChange = (event) => setReduced(event.matches);
        if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
        else if (typeof query.addListener === 'function') query.addListener(onChange);
        return () => {
          if (typeof query.removeEventListener === 'function') query.removeEventListener('change', onChange);
          else if (typeof query.removeListener === 'function') query.removeListener(onChange);
        };
      }, []);
      return reduced;
    }

    /** One word, memoized: only the newly appended words mount and animate. */
    const WordToken = React.memo(function WordToken(props) {
      const style = props.delay > 0 ? { animationDelay: props.delay + 'ms' } : undefined;
      return h('span', { className: 'blp-word', style: style }, props.text);
    });

    /** Pin the flow's right edge to the ticker's content edge. */
    function flowShift(field, flow, paddingRef) {
      if (paddingRef.current === null) {
        const style = window.getComputedStyle(field);
        paddingRef.current = {
          left: parseFloat(style.paddingLeft) || 0,
          right: parseFloat(style.paddingRight) || 0,
        };
      }
      const available = field.clientWidth - paddingRef.current.left - paddingRef.current.right;
      const overflow = Math.max(0, flow.scrollWidth - available);
      return 'translate3d(' + (-overflow).toFixed(1) + 'px,0,0)';
    }

    /**
     * Horizontal thought ticker. New words append at the right and leap in; the
     * flow slides left with one transform transition. When the flow gets long,
     * the oldest words are cut in batches and the transform is re-based without
     * a transition, so the visible words stay put.
     */
    function WordTicker(props) {
      const fieldRef = useRef(null);
      const flowRef = useRef(null);
      const pendingTrim = useRef(false);
      const paddingRef = useRef(null);
      const tokens = props.tokens;
      const onTrim = props.onTrim;

      useLayoutEffect(() => {
        const field = fieldRef.current;
        const flow = flowRef.current;
        if (field === null || flow === null) return;
        const shift = flowShift(field, flow, paddingRef);
        if (pendingTrim.current) {
          pendingTrim.current = false;
          flow.style.transition = 'none';
          flow.style.transform = shift;
          void flow.offsetWidth;
          flow.style.transition = '';
          return;
        }
        if (onTrim !== undefined && tokens.length > TRIM_AT) {
          flow.style.transition = 'none';
          flow.style.transform = shift;
          void flow.offsetWidth;
          flow.style.transition = '';
          pendingTrim.current = true;
          onTrim();
          return;
        }
        flow.style.transform = shift;
      }, [tokens, onTrim]);

      // Keep the current window pinned when the surface is resized.
      useEffect(() => {
        const field = fieldRef.current;
        if (field === null || typeof ResizeObserver !== 'function') return undefined;
        const observer = new ResizeObserver(() => {
          const flow = flowRef.current;
          if (flow === null) return;
          paddingRef.current = null;
          flow.style.transition = 'none';
          flow.style.transform = flowShift(field, flow, paddingRef);
          void flow.offsetWidth;
          flow.style.transition = '';
        });
        observer.observe(field);
        return () => observer.disconnect();
      }, []);

      return h(
        'div',
        { className: 'blp-ticker', ref: fieldRef, 'aria-hidden': 'true' },
        h(
          'div',
          { className: 'blp-tickerFlow', ref: flowRef },
          tokens.map((token) => h(WordToken, { key: token.id, text: token.text, delay: token.delay })),
        ),
      );
    }

    /* ---------- sidebar panel: glass stage with the same leap, demo text ---------- */

    /** Main-column page: a glass dialog where a sample thought streams and leaps. */
    function ByteLeapPage(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const tRef = useRef(t);
      tRef.current = t;
      const reduced = useReducedMotion();
      const [tokens, setTokens] = useState([]);
      const [stats, setStats] = useState({ words: 0, rate: 0 });
      const seq = useRef(0);
      const timer = useRef(null);
      const runStart = useRef(0);

      const trim = useCallback(() => {
        setTokens((previous) => (previous.length > TRIM_KEEP ? previous.slice(previous.length - TRIM_KEEP) : previous));
      }, []);

      const stop = useCallback(() => {
        if (timer.current !== null) {
          clearTimeout(timer.current);
          timer.current = null;
        }
      }, []);

      const play = useCallback(() => {
        stop();
        if (reduced) return;
        const pieces = tokenizeWords(tRef.current('demo'));
        setTokens([]);
        setStats({ words: 0, rate: 0 });
        seq.current = 0;
        runStart.current = performance.now();
        let index = 0;
        let words = 0;
        const step = () => {
          if (index >= pieces.length) {
            timer.current = setTimeout(() => {
              timer.current = null;
              play();
            }, 2400);
            return;
          }
          const batch = [];
          const burst = Math.random() < 0.34 ? 2 : 1;
          for (let count = 0; count < burst && index < pieces.length; count += 1) {
            batch.push({ id: seq.current, text: pieces[index], delay: count * 32 });
            seq.current += 1;
            index += 1;
            words += 1;
          }
          setTokens((previous) => previous.concat(batch));
          const seconds = Math.max(0.4, (performance.now() - runStart.current) / 1000);
          setStats({ words: words, rate: Math.round(words / seconds) });
          timer.current = setTimeout(step, 66 + Math.round(Math.random() * 44));
        };
        timer.current = setTimeout(step, 340);
      }, [reduced, stop]);

      useEffect(() => {
        play();
        return stop;
      }, [play, stop]);

      return h(
        'section',
        { className: 'blp-root', 'aria-label': t('panel.title') },
        h(StyleSheet, null),
        h(
          'div',
          { className: 'blp-backdrop', 'aria-hidden': 'true' },
          h('span', { className: 'blp-blob blp-blobA' }),
          h('span', { className: 'blp-blob blp-blobB' }),
          h('span', { className: 'blp-blob blp-blobC' }),
          h('span', { className: 'blp-mesh' }),
        ),
        h(
          'div',
          { className: 'blp-scroll' },
          h(
            'div',
            { className: 'blp-content' },
            h(
              'header',
              { className: 'blp-head' },
              h(
                'div',
                { className: 'blp-headText' },
                h('h1', { className: 'blp-title' }, t('panel.title')),
                h('p', { className: 'blp-subtitle' }, t('panel.subtitle')),
              ),
              h(
                'span',
                { className: 'blp-badge' },
                h('span', { className: 'blp-badgeDot', 'aria-hidden': 'true' }),
                t('panel.badge'),
              ),
            ),
            h(
              'div',
              { className: 'blp-glass blp-stage' },
              h('span', { className: 'blp-aura', 'aria-hidden': 'true' }),
              h(
                'div',
                { className: 'blp-stageTop' },
                h('span', { className: 'blp-stageLabel' }, t('stage.label')),
                h('span', { className: 'blp-stageRule', 'aria-hidden': 'true' }),
              ),
              reduced
                ? h('p', { className: 'blp-demo' }, t('demo'))
                : h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      {
                        className: 'blp-ribbon blp-ribbonStage',
                        role: 'group',
                        'aria-label': t('panel.subtitle'),
                      },
                      h(WordTicker, { tokens: tokens, onTrim: trim }),
                    ),
                    h(
                      'div',
                      { className: 'blp-stageFoot' },
                      h('span', { className: 'blp-stat' }, t('stat.words', { words: stats.words })),
                      h('span', { className: 'blp-sep', 'aria-hidden': 'true' }),
                      h('span', { className: 'blp-stat' }, t('stat.rate', { rate: stats.rate })),
                      h(
                        'button',
                        { type: 'button', className: 'blp-btn blp-btnGhost', onClick: play },
                        h(
                          'svg',
                          {
                            className: 'blp-btnGlyph',
                            viewBox: '0 0 16 16',
                            width: 12,
                            height: 12,
                            fill: 'none',
                            'aria-hidden': 'true',
                            focusable: 'false',
                          },
                          h('path', {
                            d: 'M13.5 8A5.5 5.5 0 1 1 8 2.5',
                            stroke: 'currentColor',
                            strokeWidth: 1.6,
                            strokeLinecap: 'round',
                          }),
                          h('path', {
                            d: 'M13.5 2.4v3.4h-3.4',
                            stroke: 'currentColor',
                            strokeWidth: 1.6,
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          }),
                        ),
                        t('action.replay'),
                      ),
                    ),
                  ),
            ),
            h(
              'div',
              { className: 'blp-cards' },
              h(
                'article',
                { className: 'blp-glass blp-card' },
                h(
                  'div',
                  { className: 'blp-cardHead' },
                  h('span', { className: 'blp-cardIndex', 'aria-hidden': 'true' }, '01'),
                  h('h2', { className: 'blp-cardTitle' }, t('opt.title')),
                ),
                h(
                  'ul',
                  { className: 'blp-list' },
                  ['opt.line1', 'opt.line2', 'opt.line3'].map((key) => h('li', { key: key }, t(key))),
                ),
              ),
              h(
                'article',
                { className: 'blp-glass blp-card' },
                h(
                  'div',
                  { className: 'blp-cardHead' },
                  h('span', { className: 'blp-cardIndex', 'aria-hidden': 'true' }, '02'),
                  h('h2', { className: 'blp-cardTitle' }, t('mat.title')),
                ),
                h(
                  'ul',
                  { className: 'blp-list' },
                  ['mat.line1', 'mat.line2', 'mat.line3'].map((key) => h('li', { key: key }, t(key))),
                ),
              ),
            ),
          ),
        ),
      );
    }

    /**
     * The sidebar glyph: three tokens leaving a glass gate. It also mounts the
     * package stylesheet, which keeps the conversation-text animation alive
     * while the sidebar row is rendered, whether or not the panel is open.
     */
    function ByteLeapIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 16;
      return h(
        React.Fragment,
        null,
        h(StyleSheet, null),
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            'aria-hidden': 'true',
            focusable: 'false',
            style: { display: 'block', flex: 'none' },
          },
          h('path', {
            d: 'M3.2 12c0-2.6 2.1-4.7 4.7-4.7',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            opacity: 0.55,
          }),
          h('path', {
            d: 'M3.2 12c0 2.6 2.1 4.7 4.7 4.7',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            opacity: 0.55,
          }),
          h('path', {
            d: 'M10.4 9.4h3.3M12.2 12h6M11 14.6h4.2',
            stroke: 'currentColor',
            strokeWidth: 1.7,
            strokeLinecap: 'round',
          }),
        ),
      );
    }

    const CSS = `
.blp-root {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-family: var(--dsw-font-family, inherit);
  font-size: var(--dsh-content-font-size, 14px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
}
.blp-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.blp-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(72px);
  opacity: 0.55;
  animation: blp-drift 28s ease-in-out infinite;
}
.blp-blobA {
  width: 600px;
  height: 600px;
  left: -180px;
  top: -220px;
  background: radial-gradient(
    circle at 44% 44%,
    color-mix(in srgb, var(--dsw-alias-label-secondary) 34%, transparent),
    transparent 68%
  );
  animation-duration: 26s;
}
.blp-blobB {
  width: 480px;
  height: 480px;
  right: -160px;
  top: 22%;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent),
    transparent 70%
  );
  animation-duration: 34s;
  animation-delay: -9s;
}
.blp-blobC {
  width: 640px;
  height: 440px;
  left: 24%;
  bottom: -240px;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--dsw-alias-label-secondary) 26%, transparent),
    transparent 72%
  );
  animation-duration: 40s;
  animation-delay: -18s;
}
@keyframes blp-drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(16px, -12px, 0) scale(1.05); }
}
.blp-mesh {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, rgba(130, 137, 145, 0.24) 1px, transparent 0);
  background-size: 26px 26px;
  mask-image: radial-gradient(ellipse at 32% 4%, #000 0%, transparent 72%);
  -webkit-mask-image: radial-gradient(ellipse at 32% 4%, #000 0%, transparent 72%);
  opacity: 0.5;
}
.blp-scroll {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: auto;
  scrollbar-gutter: stable;
}
.blp-content {
  box-sizing: border-box;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 clamp(24px, 4vw, 48px) 48px;
  /* macOS with the sidebar fully hidden: keep the first column clear of the
     window controls. The frame publishes this inset while that seat is up. */
  padding-left: max(clamp(24px, 4vw, 48px), var(--dsh-frame-leading-clearance, 0px));
}
.blp-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding-top: 28px;
  margin-bottom: 18px;
}
.blp-headText { min-width: 0; }
.blp-title {
  margin: 0;
  font-size: calc(var(--dsh-content-font-size, 14px) + 6px);
  font-weight: 600;
  letter-spacing: -0.012em;
  line-height: calc(28px + var(--dsh-content-font-delta, 0px));
}
.blp-subtitle {
  margin: 4px 0 0;
  max-width: 56ch;
  font-size: max(12px, calc(var(--dsh-content-font-size, 14px) - 1px));
  letter-spacing: 0.004em;
  line-height: calc(20px + var(--dsh-content-font-delta, 0px));
  color: color-mix(in srgb, var(--dsw-alias-label-secondary) 92%, var(--dsw-alias-label-primary));
}
.blp-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: calc(26px + var(--dsh-content-font-delta, 0px));
  padding: 0 11px;
  border-radius: 999px;
  font-size: max(11px, calc(var(--dsh-content-font-size, 14px) - 2.5px));
  letter-spacing: 0.015em;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  background: rgba(255, 255, 255, 0.22);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 44%, transparent);
  border: 0.5px solid rgba(255, 255, 255, 0.46);
  border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 60%, rgba(255, 255, 255, 0.4));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.blp-badgeDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(
    140deg,
    color-mix(in srgb, var(--dsw-alias-label-primary) 62%, transparent),
    color-mix(in srgb, var(--dsw-alias-label-secondary) 72%, transparent)
  );
  box-shadow: 0 0 8px color-mix(in srgb, var(--dsw-alias-label-secondary) 45%, transparent);
  animation: blp-dot-breathe 2400ms ease-in-out infinite;
}
@keyframes blp-dot-breathe {
  0%, 100% { opacity: 0.72; }
  50% { opacity: 1; }
}
.blp-glass {
  position: relative;
  box-sizing: border-box;
  border-radius: var(--dsw-radius-panel, 26px);
  border: 0.5px solid rgba(255, 255, 255, 0.58);
  border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 58%, #b3bcc4 42%);
  background: rgba(232, 238, 243, 0.34);
  background:
    linear-gradient(168deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.18) 22%, rgba(255, 255, 255, 0) 46%),
    linear-gradient(
      148deg,
      color-mix(in srgb, var(--dsw-alias-bg-layer-1) 44%, transparent) 0%,
      color-mix(in srgb, #8f9aa4 34%, transparent) 40%,
      color-mix(in srgb, var(--dsw-alias-bg-layer-2) 32%, transparent) 74%,
      color-mix(in srgb, #b6bec6 22%, transparent) 100%
    );
  backdrop-filter: blur(32px) saturate(112%);
  -webkit-backdrop-filter: blur(32px) saturate(112%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 0 rgba(90, 105, 120, 0.11),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.26),
    0 30px 68px -36px rgba(20, 30, 42, 0.5),
    0 4px 14px -10px rgba(20, 30, 42, 0.2);
}
.blp-glass::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.045;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
}
body[data-ds-dark-theme] .blp-blob { opacity: 0.38; }
body[data-ds-dark-theme] .blp-mesh { opacity: 0.28; }
body[data-ds-dark-theme] .blp-badge {
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 60%, transparent);
  border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 66%, #9aa5ae 34%);
}
body[data-ds-dark-theme] .blp-glass {
  border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 68%, #9aa5ae 32%);
  background:
    linear-gradient(168deg, rgba(226, 238, 248, 0.13) 0%, rgba(226, 238, 248, 0.03) 22%, rgba(226, 238, 248, 0) 44%),
    linear-gradient(
      148deg,
      color-mix(in srgb, var(--dsw-alias-bg-layer-1) 44%, transparent) 0%,
      color-mix(in srgb, #77818a 28%, transparent) 40%,
      color-mix(in srgb, var(--dsw-alias-bg-layer-2) 40%, transparent) 74%,
      color-mix(in srgb, #969ea6 16%, transparent) 100%
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.13),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3),
    inset 0 0 0 0.5px rgba(188, 200, 212, 0.12),
    0 32px 76px -38px rgba(0, 0, 0, 0.78),
    0 4px 14px -8px rgba(0, 0, 0, 0.62);
}
.blp-stage {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  min-height: calc(212px + var(--dsh-content-font-delta, 0px) * 1.5);
  padding: 24px 26px;
  overflow: hidden;
}
.blp-stageTop {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.blp-stageLabel {
  flex: none;
  font-size: clamp(10.5px, calc(var(--dsh-content-font-size, 14px) - 3px), 13px);
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--dsw-alias-label-secondary) 88%, transparent);
}
.blp-stageRule {
  flex: 1;
  min-width: 24px;
  height: 1px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent),
    transparent
  );
}
.blp-demo {
  margin: 0;
  max-width: 64ch;
  font-size: var(--dsh-content-font-size, 14px);
  line-height: calc(24px + var(--dsh-content-font-delta, 0px));
  color: var(--dsw-alias-label-primary);
  text-wrap: pretty;
}
.blp-aura {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 18%;
  height: 64%;
  border-radius: 50%;
  background: radial-gradient(ellipse at 50% 50%, rgba(150, 160, 170, 0.18), rgba(150, 160, 170, 0) 68%);
  filter: blur(22px);
  pointer-events: none;
}
body[data-ds-dark-theme] .blp-aura {
  background: radial-gradient(ellipse at 50% 50%, rgba(170, 186, 200, 0.14), rgba(170, 186, 200, 0) 70%);
}
.blp-ribbon {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: calc(48px + var(--dsh-content-font-delta, 0px));
  border-radius: 999px;
  overflow: hidden;
  border: 0.5px solid rgba(255, 255, 255, 0.5);
  border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 62%, #b6bec6 38%);
  background: rgba(240, 244, 247, 0.32);
  background:
    linear-gradient(174deg, rgba(255, 255, 255, 0.36) 0%, rgba(255, 255, 255, 0.06) 40%, rgba(255, 255, 255, 0) 70%),
    linear-gradient(
      148deg,
      color-mix(in srgb, var(--dsw-alias-bg-layer-1) 34%, transparent) 0%,
      color-mix(in srgb, #a4adb6 26%, transparent) 52%,
      color-mix(in srgb, var(--dsw-alias-bg-layer-2) 24%, transparent) 100%
    );
  backdrop-filter: blur(18px) saturate(104%);
  -webkit-backdrop-filter: blur(18px) saturate(104%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.66),
    inset 0 -1px 0 rgba(90, 105, 120, 0.1),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.16);
}
body[data-ds-dark-theme] .blp-ribbon {
  border-color: color-mix(in srgb, var(--dsw-alias-border-l2) 70%, #9aa5ae 30%);
  background:
    linear-gradient(174deg, rgba(226, 238, 248, 0.07) 0%, rgba(226, 238, 248, 0) 42%),
    linear-gradient(
      148deg,
      color-mix(in srgb, var(--dsw-alias-bg-layer-1) 30%, transparent) 0%,
      color-mix(in srgb, #7c868f 22%, transparent) 52%,
      color-mix(in srgb, var(--dsw-alias-bg-layer-2) 28%, transparent) 100%
    );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.26),
    inset 0 0 0 0.5px rgba(188, 200, 212, 0.08);
}
.blp-ribbon::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 52px;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0));
}
.blp-ribbonStage { height: calc(54px + var(--dsh-content-font-delta, 0px)); border-radius: 999px; }
.blp-ticker {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 0 38px;
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent 0, #000 38px, #000 calc(100% - 38px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 38px, #000 calc(100% - 38px), transparent 100%);
}
.blp-tickerFlow {
  display: flex;
  align-items: center;
  gap: 4px;
  width: max-content;
  height: 100%;
  will-change: transform;
  transition: transform 140ms cubic-bezier(0.22, 0.7, 0.3, 1);
}
.blp-word {
  flex: none;
  font-size: max(12px, calc(var(--dsh-content-font-size, 14px) - 1px));
  line-height: calc(18px + var(--dsh-content-font-delta, 0px));
  letter-spacing: 0.01em;
  white-space: nowrap;
  color: color-mix(in srgb, var(--dsw-alias-label-primary) 86%, var(--dsw-alias-label-secondary));
  animation: blp-word-in 300ms cubic-bezier(0.18, 0.9, 0.26, 1.02) both;
}
.blp-ribbonStage .blp-word {
  font-size: calc(var(--dsh-content-font-size, 14px) + 1px);
  line-height: calc(22px + var(--dsh-content-font-delta, 0px));
  color: var(--dsw-alias-label-primary);
}
.blp-stageFoot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.blp-stat {
  display: inline-flex;
  align-items: center;
  font-size: max(11px, calc(var(--dsh-content-font-size, 14px) - 2.5px));
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: color-mix(in srgb, var(--dsw-alias-label-secondary) 90%, var(--dsw-alias-label-primary));
}
.blp-sep {
  flex: none;
  width: 1px;
  height: calc(10px + var(--dsh-content-font-delta, 0px) * 0.6);
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent);
}
.blp-stageFoot .blp-btn { margin-left: auto; }
.blp-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: calc(28px + var(--dsh-content-font-delta, 0px));
  padding: 0 12px;
  border-radius: 999px;
  border: 0.5px solid transparent;
  font: inherit;
  font-size: max(11.5px, calc(var(--dsh-content-font-size, 14px) - 2px));
  line-height: calc(18px + var(--dsh-content-font-delta, 0px));
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--ds-transition-duration, 160ms) var(--ds-ease-in-out, ease), border-color var(--ds-transition-duration, 160ms) var(--ds-ease-in-out, ease), transform var(--ds-transition-duration, 160ms) var(--ds-ease-in-out, ease), opacity var(--ds-transition-duration, 160ms) var(--ds-ease-in-out, ease);
}
.blp-btn:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary));
  outline-offset: 2px;
}
.blp-btnGhost {
  color: color-mix(in srgb, var(--dsw-alias-label-secondary) 92%, var(--dsw-alias-label-primary));
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 32%, transparent);
  border-color: color-mix(in srgb, var(--dsw-alias-label-secondary) 28%, transparent);
}
.blp-btnGhost:hover {
  color: var(--dsw-alias-label-primary);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 54%, transparent);
  border-color: color-mix(in srgb, var(--dsw-alias-label-secondary) 46%, transparent);
}
.blp-btnGhost:active { transform: translateY(1px); }
.blp-btnGlyph {
  flex: none;
  width: calc(12px + var(--dsh-content-font-delta, 0px) * 0.4);
  height: calc(12px + var(--dsh-content-font-delta, 0px) * 0.4);
}
.blp-cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
}
.blp-card {
  padding: 18px 20px;
  border-radius: calc(var(--dsw-radius-panel, 26px) - 6px);
}
.blp-cardHead {
  display: flex;
  align-items: baseline;
  gap: 9px;
}
.blp-cardIndex {
  flex: none;
  font-size: clamp(10px, calc(var(--dsh-content-font-size, 14px) - 3.5px), 12px);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.1em;
  color: color-mix(in srgb, var(--dsw-alias-label-secondary) 56%, transparent);
}
.blp-cardTitle {
  margin: 0;
  font-size: calc(var(--dsh-content-font-size, 14px) - 1px);
  font-weight: 500;
  line-height: calc(20px + var(--dsh-content-font-delta, 0px));
  color: var(--dsw-alias-label-primary);
}
.blp-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.blp-list li {
  position: relative;
  padding-left: 15px;
  font-size: max(11.5px, calc(var(--dsh-content-font-size, 14px) - 2px));
  line-height: calc(19px + var(--dsh-content-font-delta, 0px));
  color: var(--dsw-alias-label-secondary);
}
.blp-list li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: calc(7px + var(--dsh-content-font-delta, 0px) * 0.5);
  width: 4px;
  height: 4px;
  border-radius: 1.5px;
  background: linear-gradient(
    140deg,
    color-mix(in srgb, var(--dsw-alias-label-primary) 42%, transparent),
    color-mix(in srgb, var(--dsw-alias-label-secondary) 58%, transparent)
  );
  transform: rotate(45deg);
}
@keyframes blp-word-in {
  0% {
    opacity: 0.25;
    transform: translate3d(0, 10px, 0) scale(0.72);
  }
  58% {
    opacity: 1;
    transform: translate3d(0, -2px, 0) scale(1.06);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}
@keyframes blp-rise {
  0% {
    opacity: 0.6;
    transform: translate3d(0, 8px, 0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
.blp-head { animation: blp-rise 460ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.blp-stage { animation: blp-rise 520ms cubic-bezier(0.16, 1, 0.3, 1) 40ms both; }
.blp-card { animation: blp-rise 520ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.blp-cards > .blp-card:nth-child(1) { animation-delay: 100ms; }
.blp-cards > .blp-card:nth-child(2) { animation-delay: 160ms; }
/* Conversation text: while a Turn streams, each newly mounted block slides up
   and fades in; the last block of the active Markdown body keeps a slow
   opacity breath. Only transform / opacity animate, and the host's Markdown
   output is left untouched. The attribute disappears when the Turn settles. */
@keyframes blp-stream-in {
  0% { opacity: 0.72; transform: translate3d(0, 6px, 0); }
  100% { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes blp-stream-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.88; }
}
[data-streaming] :is(p, li, h1, h2, h3, h4, h5, h6, blockquote) {
  animation: blp-stream-in 360ms cubic-bezier(0.2, 0.8, 0.25, 1) both;
}
[data-streaming] > div > :is(p, li, h1, h2, h3, h4, h5, h6, blockquote):last-child,
[data-streaming] > div > div:last-child > :is(p, h1, h2, h3, h4, h5, h6, blockquote):last-child,
[data-streaming] > div > div:last-child > :is(ul, ol):last-child > li:last-child {
  animation:
    blp-stream-in 360ms cubic-bezier(0.2, 0.8, 0.25, 1) both,
    blp-stream-breathe 2200ms ease-in-out 360ms infinite;
}
@media (max-width: 820px) {
  .blp-cards { grid-template-columns: minmax(0, 1fr); }
  .blp-card { padding: 16px 18px; }
  .blp-stage {
    min-height: calc(196px + var(--dsh-content-font-delta, 0px) * 1.5);
    padding: 22px 20px;
  }
  .blp-ticker {
    padding: 0 28px;
    mask-image: linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
  }
}
/* DSH 0.2.1-rc.3 exposes these two switches; glass goes flat and opaque. */
@media (prefers-reduced-transparency: reduce) {
  body .blp-glass,
  body .blp-ribbon,
  body .blp-badge {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--dsw-alias-bg-layer-1);
  }
  body .blp-ribbon,
  body .blp-badge { background: var(--dsw-alias-bg-layer-2); }
  .blp-blob,
  .blp-mesh,
  .blp-aura { display: none; }
  .blp-glass::after { display: none; }
}
@media (prefers-contrast: more) {
  body .blp-glass,
  body .blp-ribbon,
  body .blp-badge { border-color: var(--dsw-alias-label-secondary); }
  .blp-word,
  .blp-subtitle,
  .blp-list li,
  .blp-stat,
  .blp-btnGhost { color: var(--dsw-alias-label-primary); }
  .blp-stageLabel,
  .blp-cardIndex { color: var(--dsw-alias-label-primary); }
  .blp-stageRule,
  .blp-sep { background: var(--dsw-alias-label-secondary); }
  .blp-blob,
  .blp-mesh,
  .blp-aura { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .blp-blob,
  .blp-head,
  .blp-stage,
  .blp-card,
  .blp-word,
  .blp-badgeDot,
  [data-streaming] :is(p, li, h1, h2, h3, h4, h5, h6, blockquote),
  [data-streaming] > div > :is(p, li, h1, h2, h3, h4, h5, h6, blockquote):last-child,
  [data-streaming] > div > div:last-child > :is(p, h1, h2, h3, h4, h5, h6, blockquote):last-child,
  [data-streaming] > div > div:last-child > :is(ul, ol):last-child > li:last-child {
    animation: none !important;
  }
  .blp-tickerFlow { transition: none !important; }
  .blp-btn { transition: none !important; }
  .blp-btnGhost:active { transform: none; }
}
`;

    /** The stylesheet travels with whichever surface mounts it. */
    function StyleSheet() {
      return h('style', null, CSS);
    }

    /** Register the sidebar entry, the panel, and the dictionaries. */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: zh, en: en }), 'byte-leap: dictionaries');
      const t = ctx.locale.bind(NS);

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          },
          ByteLeapPage,
        ),
      );

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 5,
            locale: NS,
            label: () => t('panel.title'),
          },
          ByteLeapIcon,
        ),
      );

    }

    return {
      inject: ['slots', 'locale'],
      apply: apply,
    };
  },
});
