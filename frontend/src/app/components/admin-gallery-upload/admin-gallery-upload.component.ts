import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';
import { GalleryService, GalleryImage } from '../../services/gallery.service';

@Component({
  selector: 'app-admin-gallery-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatCheckboxModule,
    MatExpansionModule,
    FormsModule
  ],
  templateUrl: './admin-gallery-upload.component.html',
  styleUrl: './admin-gallery-upload.component.scss'
})
export class AdminGalleryUploadComponent implements OnInit {
  // Upload properties
  selectedFiles: File[] = [];
  previewUrls: { file: File; url: string }[] = [];
  title = '';
  description = '';
  tags: string[] = [];
  tagInput = '';
  uploading = false;

  // CRUD properties
  images: GalleryImage[] = [];
  groupedImages: { [title: string]: GalleryImage[] } = {};
  availableTitles: string[] = [];
  expandedGroups: { [title: string]: boolean } = {};
  loading = false;
  editingImage: GalleryImage | null = null;
  editTitle = '';
  editDescription = '';
  editTags: string[] = [];
  editTagInput = '';
  useExistingTitle = false;
  selectedExistingTitle = '';

  maxFileSize = 5 * 1024 * 1024; // 5MB
  allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

  displayedColumns: string[] = ['thumbnail', 'title', 'tags', 'visibility', 'views', 'actions'];

  constructor(
    private galleryService: GalleryService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadImages();
  }

  loadImages(): void {
    this.loading = true;
    this.galleryService.getImages(1, 100).subscribe({
      next: (response) => {
        this.images = response.data;
        this.groupImagesByTitle();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading images:', err);
        this.snackBar.open('Failed to load images', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  groupImagesByTitle(): void {
    this.groupedImages = {};
    this.images.forEach(image => {
      const title = image.title;
      if (!this.groupedImages[title]) {
        this.groupedImages[title] = [];
      }
      this.groupedImages[title].push(image);
    });
    this.availableTitles = Object.keys(this.groupedImages).sort();
  }

  toggleGroup(title: string): void {
    this.expandedGroups[title] = !this.expandedGroups[title];
  }

  isGroupExpanded(title: string): boolean {
    return this.expandedGroups[title] || false;
  }

  getGroupImageCount(title: string): number {
    return this.groupedImages[title]?.length || 0;
  }

  onUseExistingTitleChange(): void {
    if (this.useExistingTitle && this.availableTitles.length > 0) {
      this.selectedExistingTitle = this.availableTitles[0];
      this.title = '';
    } else {
      this.selectedExistingTitle = '';
    }
  }

  onExistingTitleSelect(): void {
    // Title will be set from selectedExistingTitle in upload()
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const filesArray = Array.from(input.files);
      const validFiles: File[] = [];

      for (const file of filesArray) {
        // Validate file type
        if (!this.allowedTypes.includes(file.type)) {
          this.snackBar.open(`${file.name}: Only JPG and PNG images are allowed`, 'Close', {
            duration: 3000
          });
          continue;
        }

        // Validate file size
        if (file.size > this.maxFileSize) {
          this.snackBar.open(`${file.name}: File size must be less than 5MB`, 'Close', {
            duration: 3000
          });
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        this.selectedFiles = validFiles;
        this.generatePreviews();
      }
    }
  }

  generatePreviews(): void {
    this.previewUrls = [];

    this.selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrls.push({
          file: file,
          url: e.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    });
  }

  removeFile(file: File): void {
    this.selectedFiles = this.selectedFiles.filter(f => f !== file);
    this.previewUrls = this.previewUrls.filter(p => p.file !== file);
  }

  removeAllFiles(): void {
    this.selectedFiles = [];
    this.previewUrls = [];
  }

  addTag(): void {
    const tag = this.tagInput.trim().toLowerCase();

    if (tag && !this.tags.includes(tag) && this.tags.length < 10) {
      this.tags.push(tag);
      this.tagInput = '';
    }
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter((t) => t !== tag);
  }

  upload(): void {
    // Determine which title to use
    const finalTitle = this.useExistingTitle ? this.selectedExistingTitle : this.title.trim();

    if (this.selectedFiles.length === 0 || !finalTitle) {
      this.snackBar.open('Please provide a title and select at least one image', 'Close', {
        duration: 3000
      });
      return;
    }

    this.uploading = true;

    const formData = new FormData();

    // Append all selected files
    this.selectedFiles.forEach(file => {
      formData.append('images', file); // Changed from 'image' to 'images'
    });

    formData.append('title', finalTitle);

    if (this.description.trim()) {
      formData.append('description', this.description.trim());
    }

    if (this.tags.length > 0) {
      formData.append('tags', JSON.stringify(this.tags));
    }

    this.galleryService.uploadImage(formData).subscribe({
      next: (response) => {
        const count = response.uploadedCount || this.selectedFiles.length;
        this.snackBar.open(`Successfully uploaded ${count} image${count > 1 ? 's' : ''}!`, 'Close', {
          duration: 3000
        });

        // Reset form
        this.selectedFiles = [];
        this.previewUrls = [];
        this.title = '';
        this.description = '';
        this.tags = [];
        this.uploading = false;
        this.useExistingTitle = false;
        this.selectedExistingTitle = '';
        // Reload images list
        this.loadImages();
      },
      error: (err) => {
        console.error('Upload error:', err);
        this.snackBar.open('Failed to upload images', 'Close', {
          duration: 5000
        });
        this.uploading = false;
      }
    });
  }

  // Edit methods
  startEdit(image: GalleryImage): void {
    this.editingImage = image;
    this.editTitle = image.title;
    this.editDescription = image.description || '';
    this.editTags = [...(image.tags || [])];
  }

  cancelEdit(): void {
    this.editingImage = null;
    this.editTitle = '';
    this.editDescription = '';
    this.editTags = [];
    this.editTagInput = '';
  }

  addEditTag(): void {
    const tag = this.editTagInput.trim().toLowerCase();
    if (tag && !this.editTags.includes(tag) && this.editTags.length < 10) {
      this.editTags.push(tag);
      this.editTagInput = '';
    }
  }

  removeEditTag(tag: string): void {
    this.editTags = this.editTags.filter((t) => t !== tag);
  }

  saveEdit(): void {
    if (!this.editingImage || !this.editTitle.trim()) {
      return;
    }

    const updateData = {
      title: this.editTitle.trim(),
      description: this.editDescription.trim(),
      tags: this.editTags
    };

    this.galleryService.updateImage(this.editingImage._id, updateData).subscribe({
      next: (response) => {
        this.snackBar.open('Image updated successfully!', 'Close', {
          duration: 3000
        });
        this.cancelEdit();
        this.loadImages();
      },
      error: (err) => {
        console.error('Update error:', err);
        this.snackBar.open('Failed to update image', 'Close', {
          duration: 3000
        });
      }
    });
  }

  // Toggle visibility
  toggleVisibility(image: GalleryImage): void {
    const updateData = {
      isVisible: !image.isVisible
    };

    this.galleryService.updateImage(image._id, updateData).subscribe({
      next: (response) => {
        this.snackBar.open(
          `Image ${image.isVisible ? 'hidden' : 'visible'} successfully`,
          'Close',
          { duration: 2000 }
        );
        this.loadImages();
      },
      error: (err) => {
        console.error('Toggle visibility error:', err);
        this.snackBar.open('Failed to update visibility', 'Close', {
          duration: 3000
        });
      }
    });
  }

  // Delete method
  deleteImage(image: GalleryImage): void {
    if (!confirm(`Are you sure you want to delete "${image.title}"? This action cannot be undone.`)) {
      return;
    }

    this.galleryService.deleteImage(image._id).subscribe({
      next: (response) => {
        this.snackBar.open('Image deleted successfully!', 'Close', {
          duration: 3000
        });
        this.loadImages();
      },
      error: (err) => {
        console.error('Delete error:', err);
        this.snackBar.open('Failed to delete image', 'Close', {
          duration: 3000
        });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/gallery']);
  }
}
