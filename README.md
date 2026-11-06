# IB Atlas · Personal IB Tracker

个人 IB Diploma 学习工作台，部署到本仓库的 **GitHub Pages**。中文响应式界面，无框架与构建依赖。

## 功能

- 六大学科组、HL / SL、自定义课程与目标成绩
- 科目详情：知识点、未开始 / 学习中 / 待复习 / 已掌握、复习日期、笔记、学科任务与成绩
- 掌握进度：添加知识点后，根据已掌握比例自动计算；未添加时保留手动进度
- 任务增删改、完成状态、截止日期、优先级、科目与状态筛选
- 月历：同时展示任务、考试与 IA / EE / TOK / CAS 阶段的截止日期
- 学习日志、学习时长、最近七日统计
- 成绩与反馈、分科成绩趋势、目标对照
- IA / EE / TOK / CAS 核心项目阶段
- 25 分钟专注计时、个人档案、考试倒计时
- JSON 备份导出与恢复，兼容第一版备份

## 本地运行

```sh
python3 -m http.server 4173 --directory dist
```

打开 http://localhost:4173 。站内使用 hash 路由与相对资源路径，可直接部署至 GitHub Pages 的 `/ib-tracker/` 子路径。

## GitHub Pages

`.github/workflows/pages.yml` 在每次推送 `main` 时先运行测试，再发布 `dist/`。

在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。若首次推送时未启用，在开启后前往 Actions 手动运行 `Test and deploy IB Atlas`。

默认地址为 https://hzagaming.github.io/ib-tracker/ （只有部署成功后才可访问）。发布流程参考 [GitHub 官方指南](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

GitHub Pages 发布的是应用代码。个人学习数据仍保存在使用者自己的浏览器中，不会提交到 GitHub。

## 数据

数据使用 `localStorage`，无登录、后端或跨设备同步。定期导出备份；导入将替换当前数据。移动到新域名（例如旧 Sites 地址迁往 GitHub Pages）时，在旧地址导出，再在新地址导入。不要把个人备份提交进公开仓库。

初始记录为空。课程清单提供常见课程和自定义名称，不替代学校选课要求或对应届次的官方学科指南。删除科目会删除关联知识点，其他记录保留并归入「综合 / 核心」。

## 检查

需要 Node.js 22 或更高版本：

```sh
node --check dist/app.js
node tests/smoke.cjs
```

测试覆盖页面渲染、记录创建编辑、知识点进度、截止日期月历、筛选、存储恢复、备份兼容与异常数据校验。该测试使用轻量 DOM 替身，不替代真实浏览器视觉验收。
