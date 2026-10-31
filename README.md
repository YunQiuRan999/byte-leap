# 词元跃迁 · Byte Leap

DSH 网页端的一个小插件。左边栏会多一块毛玻璃面板，用一段固定示例演示思考时词元一个接一个出现；真正对话时，模型新写的段落会轻微上移，最后一段带一点呼吸。适配 `0.2.1-rc.3`。

装好后侧栏出现「词元跃迁」图标，点开就是这块面板。它不改对话内容，也不替换 Markdown 渲染器。

## 面板

示例文字从右边进来，一次补一两个词。词太多时，最早的一批直接丢掉，剩下的位置不动，所以画面不会跳。下面一行是累计词元数和每秒词元数，右边是重播。

## 对话

模型开始写的时候，新出现的段落、标题、列表从下方 6px 淡入；当前最后一段慢慢呼吸，直到这一轮结束。回合结束，`data-streaming` 消失，动画也就停了。

## 几个取舍

动画只碰 `transform` 和 `opacity`，不碰宽高和颜色，省得每帧重排。系统开了“减少动态效果”，面板直接显示整段示例，不播。

没有换掉 Markdown 渲染器。正文只能做到“新块入场 + 最后一段呼吸”；要逐词包起来就得自己渲染 Markdown，代码高亮和公式会丢，不划算。面板里的示例也是固定的，不读会话。

## 兼容

手头只有 0.2.1-rc.3 的环境，所以只在这个版本上逐项对过：

- 内容字号 10–22px 都试过，面板里的字号、行高、按钮高度会跟着变；
- 亮色、暗色和自定义主题都走 `--dsw-alias-*`，没有写死颜色；
- 系统开“减少透明度”时，玻璃变平、底色换成主题层级色；开“高对比度”时，文字提到主色；
- 侧栏按 `sidebar.panellist` + `main` key 注册，标题跟语言切换，也支持 pin 和 More 菜单；
- macOS 收起侧栏时，第一列按 `--dsh-frame-leading-clearance` 让开窗口按钮。

## 安装

把仓库放到本地，然后把路径换成自己的：

```bash
dsh plugin --profile web add link:/absolute/path/to/byte-leap
```

也可以在 Harness 会话里让 Agent 装：

```text
plugin_manager(action: "install_bundle", target: "/absolute/path/to/byte-leap")
```

装好后侧栏出现图标，一般不用重启，HMR 会生效。

## 目录结构

```text
byte-leap/
├─ package.json        # bundle 清单：dsh.bundle.patch + dsh.client
├─ cordis.patch.yml    # Loader 补丁：插入 byte-leap 行
├─ index.js            # Host 侧（没有逻辑，只给 bundle 一个 Loader 入口）
├─ client.js           # 浏览器侧：面板、词元动画、对话流式动画
├─ locale/
│  ├─ zh.json          # 插件展示名和描述（中文）
│  └─ en.json          # 插件展示名和描述（英文）
└─ icon.svg            # 图标：灰蓝玻璃 + 跃出的词元
```

## 版本

`1.2.1` 把统计收成一行，加了“示例”小标和卡片编号；`1.2.0` 开始跟 DSH 的字号和主题 token 走，并补了减少透明度、高对比度的分支；`1.1.1` 修了词元被裁切和最后一段呼吸没命中的问题。

## 许可

MIT
