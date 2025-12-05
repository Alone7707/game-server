<template>
  <div
    class="playing-card"
    :class="{
      'selected': selected,
      'disabled': disabled,
      'deal-card': animate,
    }"
    :style="{ animationDelay: `${animationDelay}ms` }"
    @click="handleClick"
  >
    <div class="text-left w-full">
      <span 
        class="text-lg font-bold"
        :class="isRedSuit ? 'card-suit-red' : 'card-suit-black'"
      >
        {{ displayValue }}
      </span>
    </div>
    
    <div class="text-3xl" :class="isRedSuit ? 'card-suit-red' : 'card-suit-black'">
      {{ suitSymbol }}
    </div>
    
    <div class="text-right w-full rotate-180">
      <span 
        class="text-lg font-bold"
        :class="isRedSuit ? 'card-suit-red' : 'card-suit-black'"
      >
        {{ displayValue }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~/types'
import { getSuitSymbol, isRedSuit as checkRedSuit } from '~/utils/cards'

const props = defineProps<{
  card: Card
  selected?: boolean
  disabled?: boolean
  isReadOnly?: boolean
  animate?: boolean
  animationDelay?: number
}>()

const emit = defineEmits<{
  (e: 'click', card: Card): void
}>()

const displayValue = computed(() => props.card.display)

const suitSymbol = computed(() => {
  if (props.card.value === 'joker_small') return '🃏'
  if (props.card.value === 'joker_big') return '👑'
  return getSuitSymbol(props.card.suit)
})

const isRedSuit = computed(() => checkRedSuit(props.card.suit))

function handleClick() {
  if (!props.disabled && !props.isReadOnly) {
    emit('click', props.card)
  }
}
</script>
