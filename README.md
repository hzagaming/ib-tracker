# IB Atlas

个人 IB Diploma 学习工作台。中文响应式界面，无框架依赖。

## 使用

在仓库目录运行 `python3 -m http.server 4173 --directory dist`，打开 http://localhost:4173 。

包含总览、可自定义的六大学科组选课（HL/SL）、任务增删改与完成状态、学习日志、成绩与反馈、IA/EE/TOK/CAS 项目阶段、专注计时、个人档案及 JSON 备份恢复。

所有个人数据保存在当前浏览器 localStorage 中，不提供跨设备同步。定期导出备份；导入会替换当前数据。科目清单为示例，不替代学校课程与对应届次指南。初始数据为空。

## 文件

- `dist/index.html`：应用入口
- `dist/style.css`：响应式界面
- `dist/app.js`：交互、记录管理、本地持久化与备份

## 验证

`node --check dist/app.js` 验证 JavaScript 语法。浏览器中验证添加科目、任务完成状态、日志和成绩记录、核心项目阶段、刷新持久化与备份恢复。
