// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  ssr: true,
  
  devServer: {
    host: '0.0.0.0', // 监听所有网络接口，允许局域网访问
    port: 3001, // 开发环境端口
  },
  
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
  ],
  
  css: ['~/assets/css/main.css'],
  
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.js',
  },
  
  pinia: {
    storesDirs: ['./stores/**'],
  },
  
  nitro: {
    experimental: {
      websocket: true,
    },
  },
  
  runtimeConfig: {
    public: {
      socketUrl: process.env.SOCKET_URL || '',
    },
  },
  
  app: {
    head: {
      title: '游戏大厅 - Game Server',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '在线斗地主游戏' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
  
  compatibilityDate: '2024-12-01',
})
