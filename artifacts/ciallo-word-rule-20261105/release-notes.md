修复 Ciallo 回复误判。

- 独立词 `ciallo` 判通过，`ciao` 判未通过；忽略大小写、标点和表情。
- `Ciallo! 👋 What can I help you with?`、`Ciallo～ 👋`、`Ciallo～ 👋 What can I help you with?` 均通过。
- 两者都有或都没有时显示“无法判断”，不计入通过率。
- 历史按当前规则从原回复重新显示判定，保留原文及存储记录；请求失败和跳过记录保持原状。

Go race/vet、前端构建及交互检查通过；Clouvider 已热更新，三条历史误判已更正，GPT-6-Astra 单账号 Ciallo 实测通过。无需重启服务。

此规则仅供娱乐，不能据此确认模型身份或性能。
