<script setup>
import { ref, computed } from 'vue';
import { ChevronDown, ChevronUp, Copy, Check, Bot, User, Zap } from 'lucide-vue-next';

const props = defineProps({
  result: { type: Object, default: null },
});

const open      = ref(false);
const activeTab = ref('system');
const copied    = ref(false);

const tabs = computed(() => {
  if (!props.result) return [];
  const t = [
    { id: 'system', label: 'System Prompt' },
    { id: 'user',   label: 'User Prompt'   },
  ];
  (props.result.llmRawResponses ?? []).forEach((r) => {
    t.push({ id: `llm-${r.iteration}`, label: `LLM Response #${r.iteration}` });
  });
  return t;
});

const currentContent = computed(() => {
  if (!props.result) return '';
  if (activeTab.value === 'system') return props.result.prompt?.systemPrompt ?? '';
  if (activeTab.value === 'user')   return props.result.prompt?.userPrompt   ?? '';
  const idx = activeTab.value.replace('llm-', '');
  const raw = (props.result.llmRawResponses ?? []).find((r) => String(r.iteration) === idx);
  return raw?.content ?? '';
});

const currentUsage = computed(() => {
  if (!activeTab.value.startsWith('llm-')) return null;
  const idx = activeTab.value.replace('llm-', '');
  return (props.result?.llmRawResponses ?? []).find((r) => String(r.iteration) === idx)?.usage ?? null;
});

async function copyContent() {
  if (!currentContent.value) return;
  await navigator.clipboard.writeText(currentContent.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 1800);
}

function toggle() {
  open.value = !open.value;
  if (open.value && tabs.value.length) activeTab.value = tabs.value[0].id;
}
</script>

<template>
  <div v-if="result" class="inspector glass-panel">
    <button class="inspector-toggle" @click="toggle" :aria-expanded="open">
      <div class="toggle-left">
        <component :is="Zap" class="toggle-icon" />
        <span class="toggle-title">Prompt Inspector</span>
        <span v-if="result.chartSource" class="source-badge" :class="`source-${result.chartSource}`">
          {{ result.chartSource }}
        </span>
        <span v-if="result.chartReasoning" class="reasoning-text">
          {{ result.chartReasoning }}
        </span>
      </div>
      <component :is="open ? ChevronUp : ChevronDown" class="chevron-icon" />
    </button>

    <div v-if="open" class="inspector-body">
      <div class="tabs-row">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <component
            :is="tab.id === 'system' ? Bot : tab.id === 'user' ? User : ChevronDown"
            class="tab-icon"
          />
          {{ tab.label }}
        </button>

        <div class="tabs-spacer" />

        <div v-if="currentUsage" class="usage-pills">
          <span class="usage-pill">↑ {{ currentUsage.promptTokens ?? '—' }} pt</span>
          <span class="usage-pill">↓ {{ currentUsage.completionTokens ?? '—' }} ct</span>
          <span v-if="currentUsage.latencyMs" class="usage-pill">
            {{ Math.round(currentUsage.latencyMs) }} ms
          </span>
        </div>

        <button class="copy-btn" @click="copyContent" :title="copied ? 'Copied!' : 'Copy to clipboard'">
          <component :is="copied ? Check : Copy" class="copy-icon" :class="{ 'copy-ok': copied }" />
        </button>
      </div>

      <div class="code-wrapper">
        <pre class="code-pre"><code>{{ currentContent || '(empty)' }}</code></pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inspector {
  overflow: hidden;
}

.inspector-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0.75rem 1.25rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.inspector-toggle:hover {
  background: rgba(0, 0, 0, 0.02);
}

.toggle-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.toggle-icon {
  width: 13px;
  height: 13px;
  color: var(--accent);
  flex-shrink: 0;
}

.toggle-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text1);
  flex-shrink: 0;
}

.source-badge {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  padding: 2px 7px;
  border-radius: 20px;
  flex-shrink: 0;
}

.source-rule-based   { background: rgba(31, 111, 235, 0.1);  color: var(--accent);  border: 1px solid rgba(31,111,235,0.25); }
.source-llm          { background: rgba(130, 80, 255, 0.1);  color: #8250df;        border: 1px solid rgba(130,80,255,0.25); }
.source-user-override{ background: rgba(212, 130, 0, 0.1);   color: #b45309;        border: 1px solid rgba(212,130,0,0.25);  }
.source-fallback-no-llm { background: var(--bg); color: var(--text3); border: 1px solid var(--border); }

.reasoning-text {
  font-size: 0.73rem;
  color: var(--text3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chevron-icon {
  width: 14px;
  height: 14px;
  color: var(--text3);
  flex-shrink: 0;
}

.inspector-body {
  border-top: 1px solid var(--border);
}

.tabs-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.015);
  overflow-x: auto;
  flex-wrap: nowrap;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.73rem;
  font-weight: 500;
  color: var(--text3);
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.tab-btn:hover { color: var(--text1); }
.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.tab-icon {
  width: 11px;
  height: 11px;
}

.tabs-spacer { flex: 1; }

.usage-pills {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.usage-pill {
  font-size: 0.65rem;
  color: var(--text3);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1px 6px;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.15s;
  flex-shrink: 0;
}

.copy-btn:hover { background: var(--bg); }

.copy-icon {
  width: 13px;
  height: 13px;
  color: var(--text3);
  transition: color 0.2s;
}

.copy-ok { color: var(--success) !important; }

.code-wrapper {
  max-height: 380px;
  overflow-y: auto;
  padding: 0;
}

.code-pre {
  margin: 0;
  padding: 1rem 1.25rem;
  font-family: var(--font-mono, 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace');
  font-size: 0.72rem;
  line-height: 1.65;
  color: var(--text2);
  white-space: pre-wrap;
  word-break: break-word;
  background: transparent;
}
</style>
