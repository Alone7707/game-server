<template>
  <div class="flex justify-center items-end flex-wrap gap-[-20px]">
    <div 
      v-for="(card, index) in cards" 
      :key="card.id"
      class="transform transition-all duration-200"
      :style="{ 
        marginLeft: index > 0 ? '-30px' : '0',
        zIndex: index,
      }"
    >
      <PlayingCard
        :card="card"
        :selected="selectedIds.has(card.id)"
        :disabled="disabled"
        :animate="animate"
        :animation-delay="index * 50"
        @click="handleCardClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~/types'

const props = defineProps<{
  cards: Card[]
  selectedCards?: Card[]
  disabled?: boolean
  animate?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', card: Card): void
}>()

const selectedIds = computed(() => {
  return new Set(props.selectedCards?.map(c => c.id) || [])
})

function handleCardClick(card: Card) {
  emit('select', card)
}
</script>
