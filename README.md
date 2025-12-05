# 斗地主 (Dou Di Zhu) - Nuxt 3 全栈游戏

一个使用 Nuxt 3 开发的在线斗地主网页游戏，支持实时多人对战。

## 🎮 功能特性

- **游戏大厅**
  - 房间列表展示（房间号、房主、人数、底分、状态）
  - 密码保护房间（🔒 锁图标标识）
  - 创建房间（可设置密码）
  - 快速加入功能

- **游戏玩法**
  - 完整的斗地主规则实现
  - 叫地主阶段（1分、2分、3分）
  - 支持所有标准牌型（单张、对子、三带一、顺子、炸弹、王炸等）
  - 实时游戏同步

- **视觉设计**
  - 深色赌场主题（深褐色、墨绿色、暗金色）
  - **无蓝色渐变**设计约束
  - 精美的扑克牌界面
  - 流畅的动画效果

## 🛠 技术栈

- **框架**: Nuxt 3 (SSR 模式)
- **前端**: Vue 3 + Composition API
- **状态管理**: Pinia
- **样式**: Tailwind CSS
- **后端**: Nitro 引擎 (Koa 风格中间件)
- **实时通信**: Socket.IO

## 📁 项目结构

```
doudizhu/
├── assets/
│   └── css/main.css          # 全局样式
├── components/
│   ├── CardHand.vue          # 手牌组件
│   ├── CreateRoomModal.vue   # 创建房间弹窗
│   ├── GameResultModal.vue   # 游戏结果弹窗
│   ├── Modal.vue             # 通用弹窗
│   ├── OpponentCards.vue     # 对手牌区
│   ├── PasswordModal.vue     # 密码输入弹窗
│   ├── PlayingCard.vue       # 扑克牌组件
│   └── RoomList.vue          # 房间列表
├── composables/
│   └── useSocket.ts          # Socket.IO 封装
├── layouts/
│   └── default.vue           # 默认布局
├── pages/
│   ├── index.vue             # 游戏大厅
│   └── room/[id].vue         # 游戏房间
├── server/
│   ├── plugins/
│   │   └── socket.ts         # Socket.IO 服务端插件
│   └── utils/
│       └── gameState.ts      # 游戏状态管理
├── stores/
│   ├── game.ts               # 游戏状态
│   ├── room.ts               # 房间状态
│   └── user.ts               # 用户状态
├── types/
│   └── index.ts              # TypeScript 类型定义
├── utils/
│   ├── cards.ts              # 扑克牌逻辑
│   └── helpers.ts            # 工具函数
├── nuxt.config.ts            # Nuxt 配置
├── package.json              # 依赖配置
└── tailwind.config.js        # Tailwind 配置
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 生产构建

```bash
npm run build
npm run preview
```

## 🎯 游戏规则

### 基本规则
- 三人游戏，使用一副牌（54张，含大小王）
- 每人发17张牌，3张底牌归地主
- 地主对战两个农民

### 叫地主
- 玩家轮流叫分（1分、2分、3分或不叫）
- 叫3分直接成为地主
- 叫分最高者成为地主

### 出牌规则
- 地主先出牌，按顺序轮流
- 后出的牌必须大过前面的牌
- 可以选择"不出"跳过

### 牌型大小
- 单张：3 < 4 < ... < K < A < 2 < 小王 < 大王
- 对子、三张：按单牌大小比较
- 炸弹：四张相同的牌，可以打任何非炸弹牌型
- 王炸（火箭）：大小王，最大牌型

### 胜负判定
- 地主先出完所有牌 → 地主胜
- 任一农民先出完所有牌 → 农民胜

## 📝 待完善功能

- [ ] 玩家断线重连
- [ ] 游戏记录/回放
- [ ] 音效系统
- [ ] 观战模式
- [ ] 排行榜
- [ ] AI 玩家

## 📄 许可证

MIT License
