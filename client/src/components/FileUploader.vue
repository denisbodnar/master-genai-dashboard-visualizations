<template>
  <div
    class="uploader"
    :class="state"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="fileInput.click()"
  >
    <div class="icon-ring" :class="state">
      <component :is="file ? FileCheckIcon : UploadCloudIcon" class="upload-icon" />
    </div>

    <div class="uploader-text">
      <div class="uploader-title">
        {{ file ? file.name : isDragging ? 'Drop to upload' : 'Upload CSV Dataset' }}
      </div>
      <div class="uploader-sub" :class="{ 'sub-success': !!file }">
        {{ file ? `${(file.size / 1024).toFixed(1)} KB · CSV` : 'Drag & drop or click to browse' }}
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".csv" style="display:none" @change="onFileSelect" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { UploadCloud, FileCheck } from 'lucide-vue-next';

const props = defineProps({ file: { type: File, default: null } });
const emit = defineEmits(['update:file']);

const isDragging = ref(false);
const fileInput = ref(null);

const UploadCloudIcon = UploadCloud;
const FileCheckIcon = FileCheck;

const state = computed(() => props.file ? 'loaded' : isDragging.value ? 'dragging' : 'idle');

const onDrop = (e) => {
  isDragging.value = false;
  const f = e.dataTransfer.files[0];
  if (f?.name.endsWith('.csv')) emit('update:file', f);
};

const onFileSelect = (e) => {
  const f = e.target.files[0];
  if (f) emit('update:file', f);
};
</script>

<style scoped>
.uploader {
  background: var(--bg);
  border: 1.5px dashed var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.25s;
  user-select: none;
  text-align: center;
}

.uploader.loaded  { border-color: var(--success); background: var(--success-subtle); }
.uploader.dragging { border-color: var(--accent); background: rgba(9, 105, 218, 0.06); }

.icon-ring {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(9, 105, 218, 0.1);
  border: 1px solid rgba(9, 105, 218, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  transition: all 0.25s;
}

.icon-ring.loaded {
  background: var(--success-subtle);
  border-color: var(--success-border);
  color: var(--success);
}

.upload-icon {
  width: 20px;
  height: 20px;
}

.uploader-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text1);
  margin-bottom: 2px;
}

.uploader-sub {
  font-size: 0.75rem;
  color: var(--text3);
}

.uploader-sub.sub-success {
  color: var(--success);
}
</style>
