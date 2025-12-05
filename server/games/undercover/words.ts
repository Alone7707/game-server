// 谁是卧底词库
// 每组包含 [平民词, 卧底词]

export interface WordPair {
  civilian: string  // 平民词
  undercover: string  // 卧底词
  category: 'daily' | 'celebrity' | 'place' | 'abstract'  // 分类
}

export const wordPairs: WordPair[] = [
  // 日常用品
  { civilian: '奶茶', undercover: '咖啡', category: 'daily' },
  { civilian: '馒头', undercover: '包子', category: 'daily' },
  { civilian: '筷子', undercover: '叉子', category: 'daily' },
  { civilian: '牙膏', undercover: '牙刷', category: 'daily' },
  { civilian: '毛巾', undercover: '浴巾', category: 'daily' },
  { civilian: '眼镜', undercover: '墨镜', category: 'daily' },
  { civilian: '手机', undercover: '平板', category: 'daily' },
  { civilian: '钢笔', undercover: '铅笔', category: 'daily' },
  { civilian: '米饭', undercover: '面条', category: 'daily' },
  { civilian: '苹果', undercover: '梨子', category: 'daily' },
  { civilian: '可乐', undercover: '雪碧', category: 'daily' },
  { civilian: '饺子', undercover: '馄饨', category: 'daily' },
  { civilian: '蛋糕', undercover: '面包', category: 'daily' },
  { civilian: '牛奶', undercover: '酸奶', category: 'daily' },
  { civilian: '薯条', undercover: '薯片', category: 'daily' },
  { civilian: '口红', undercover: '唇膏', category: 'daily' },
  { civilian: '耳机', undercover: '音响', category: 'daily' },
  { civilian: '钱包', undercover: '卡包', category: 'daily' },
  { civilian: '沙发', undercover: '椅子', category: 'daily' },
  { civilian: '被子', undercover: '毯子', category: 'daily' },
  
  // 名人
  { civilian: '刘德华', undercover: '周润发', category: 'celebrity' },
  { civilian: '周杰伦', undercover: '林俊杰', category: 'celebrity' },
  { civilian: '成龙', undercover: '李连杰', category: 'celebrity' },
  { civilian: '赵本山', undercover: '宋小宝', category: 'celebrity' },
  { civilian: '郭德纲', undercover: '岳云鹏', category: 'celebrity' },
  { civilian: '姚明', undercover: '易建联', category: 'celebrity' },
  { civilian: '马云', undercover: '马化腾', category: 'celebrity' },
  { civilian: '李白', undercover: '杜甫', category: 'celebrity' },
  { civilian: '孙悟空', undercover: '猪八戒', category: 'celebrity' },
  { civilian: '蜘蛛侠', undercover: '蝙蝠侠', category: 'celebrity' },
  
  // 地点
  { civilian: '北京', undercover: '上海', category: 'place' },
  { civilian: '长城', undercover: '故宫', category: 'place' },
  { civilian: '医院', undercover: '诊所', category: 'place' },
  { civilian: '超市', undercover: '便利店', category: 'place' },
  { civilian: '图书馆', undercover: '书店', category: 'place' },
  { civilian: '电影院', undercover: '剧院', category: 'place' },
  { civilian: '游泳池', undercover: '浴室', category: 'place' },
  { civilian: '火车站', undercover: '汽车站', category: 'place' },
  { civilian: '机场', undercover: '码头', category: 'place' },
  { civilian: '公园', undercover: '广场', category: 'place' },
  
  // 抽象概念
  { civilian: '初恋', undercover: '暗恋', category: 'abstract' },
  { civilian: '梦想', undercover: '理想', category: 'abstract' },
  { civilian: '友情', undercover: '爱情', category: 'abstract' },
  { civilian: '勇敢', undercover: '鲁莽', category: 'abstract' },
  { civilian: '骄傲', undercover: '自信', category: 'abstract' },
  { civilian: '紧张', undercover: '害怕', category: 'abstract' },
  { civilian: '开心', undercover: '兴奋', category: 'abstract' },
  { civilian: '伤心', undercover: '难过', category: 'abstract' },
  { civilian: '无聊', undercover: '寂寞', category: 'abstract' },
  { civilian: '幸福', undercover: '快乐', category: 'abstract' },
]

// 随机获取一组词
export function getRandomWordPair(): WordPair {
  const index = Math.floor(Math.random() * wordPairs.length)
  return wordPairs[index]
}

// 按分类获取词组
export function getWordPairsByCategory(category: WordPair['category']): WordPair[] {
  return wordPairs.filter(w => w.category === category)
}
