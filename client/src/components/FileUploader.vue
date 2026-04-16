<template>
  <div 
    class="glass-panel uploader-container" 
    :class="{ 'is-dragging': isDragging, 'has-file': file }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="triggerFileInput"
  >
    <div class="uploader-content">
      <div class="icon-wrapper">
        <component :is="file ? FileCheckIcon : UploadCloudIcon" class="icon" />
      </div>
      
      <div v-if="!file" class="text-content">
        <h3>Upload CSV Dataset</h3>
        <p>Drag and drop your file here, or click to browse</p>
      </div>
      
      <div v-else class="text-content file-info">
        <h3>{{ file.name }}</h3>
        <p>{{ (file.size / 1024).toFixed(1) }} KB</p>
      </div>
      
      <input 
        ref="fileInput" 
        type="file" 
        accept=".csv" 
        class="hidden-input" 
        @change="onFileSelect" 
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { UploadCloud, FileCheck } from 'lucide-vue-next';

const props = defineProps({
  file: {
    type: File,
    default: null
  }
});

const emit = defineEmits(['update:file']);
const isDragging = ref(false);
const fileInput = ref(null);

const UploadCloudIcon = UploadCloud;
const FileCheckIcon = FileCheck;

const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = (event) => {
  isDragging.value = false;
  if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    handleFile(event.dataTransfer.files[0]);
  }
};

const onFileSelect = (event) => {
  if (event.target.files && event.target.files.length > 0) {
    handleFile(event.target.files[0]);
  }
};

const triggerFileInput = () => {
  fileInput.value.click();
};

const handleFile = (selectedFile) => {
  if (selectedFile.name.endsWith('.csv')) {
    emit('update:file', selectedFile);
  } else {
    alert('Please upload a valid CSV file.');
  }
};
</script>

<style scoped>
.uploader-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  border: 2px dashed var(--border-color);
  cursor: pointer;
  transition: border-color var(--transition-normal), background var(--transition-normal);
  min-height: 160px;
}

.uploader-container:hover {
  border-color: var(--color-accent);
  background: rgba(9, 105, 218, 0.04);
}

.uploader-container.is-dragging {
  border-color: var(--color-accent);
  background: rgba(9, 105, 218, 0.06);
}

.uploader-container.has-file {
  border-style: solid;
  border-color: var(--color-success);
  background: rgba(26, 127, 55, 0.04);
}

.uploader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.icon-wrapper {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-bg-surface);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  transition: all var(--transition-normal);
}

.has-file .icon-wrapper {
  color: var(--color-success);
  background: rgba(26, 127, 55, 0.08);
  border-color: rgba(26, 127, 55, 0.3);
}

.icon {
  width: 24px;
  height: 24px;
}

.text-content h3 {
  font-size: 1rem;
  margin-bottom: 0.2rem;
}

.text-content p {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.file-info p {
  color: var(--color-success);
}

.hidden-input {
  display: none;
}
</style>
