module.exports = {
  apps: [{
    name: 'doudizhu',
    script: './server/index.mjs',  // 如果把此文件放到 .output 目录内
    env: {
      PORT: 3003,
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }]
}
