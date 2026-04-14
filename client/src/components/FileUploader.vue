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
  padding: 3rem 2rem;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 200px;
}

.uploader-container:hover {
  background: var(--color-bg-glass-hover);
  border-color: var(--color-accent);
}

.uploader-container.is-dragging {
  border-color: var(--color-accent);
  background: rgba(59, 130, 246, 0.1);
  transform: scale(1.02);
}

.uploader-container.has-file {
  border-style: solid;
  border-color: var(--color-success);
  background: rgba(16, 185, 129, 0.05);
}

.uploader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  transition: all 0.3s ease;
}

.has-file .icon-wrapper {
  color: var(--color-success);
  background: rgba(16, 185, 129, 0.1);
}

.icon {
  width: 32px;
  height: 32px;
}

.text-content h3 {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.text-content p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.file-info p {
  color: var(--color-success);
}

.hidden-input {
  display: none;
}
</style>
