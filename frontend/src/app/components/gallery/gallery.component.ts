import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { GalleryService, GalleryImage } from '../../services/gallery.service';
import { ImageLightboxComponent } from '../image-lightbox/image-lightbox.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss'
})
export class GalleryComponent implements OnInit {
  images: GalleryImage[] = [];
  featuredImages: GalleryImage[] = [];
  groupedImages: { [key: string]: GalleryImage[] } = {};
  availableTags: string[] = [];
  loading = false;
  error: string | null = null;
  currentPage = 1;
  totalPages = 1;
  pageSize = 20;
  searchQuery = '';
  selectedTags: string[] = [];
  isSuperAdmin = false;
  viewMode: 'all' | 'grouped' = 'grouped';
  currentSlideIndex = 0;

  // Infinite scroll
  isLoadingMore = false;
  hasMore = true;

  constructor(
    private galleryService: GalleryService,
    private dialog: MatDialog,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isSuperAdmin = this.authService.isSuperAdmin();
    this.loadImages(true);
  }

  loadImages(reset: boolean = false): void {
    if (reset) {
      this.currentPage = 1;
      this.images = [];
    }

    this.loading = true;
    this.error = null;

    this.galleryService
      .getImages(this.currentPage, this.pageSize, this.selectedTags, this.searchQuery)
      .subscribe({
        next: (response) => {
          if (reset) {
            this.images = response.data;
            // Get featured images (latest 5)
            this.featuredImages = response.data.slice(0, 5);
            // Extract all unique tags
            this.extractTags(response.data);
            // Group images if needed
            if (this.viewMode === 'grouped') {
              this.groupImagesByTags();
            }
          } else {
            this.images = [...this.images, ...response.data];
          }

          this.totalPages = response.pagination.totalPages;
          this.hasMore = this.currentPage < this.totalPages;
          this.loading = false;
          this.isLoadingMore = false;
        },
        error: (err) => {
          console.error('Error loading images:', err);
          this.error = 'Failed to load gallery images';
          this.loading = false;
          this.isLoadingMore = false;
        }
      });
  }

  extractTags(images: GalleryImage[]): void {
    const tagSet = new Set<string>();
    images.forEach(img => {
      img.tags?.forEach(tag => tagSet.add(tag));
    });
    this.availableTags = Array.from(tagSet).sort();
  }

  groupImagesByTags(): void {
    this.groupedImages = {};

    // Group images by their title
    this.images.forEach(image => {
      const title = image.title || 'Untitled';
      if (!this.groupedImages[title]) {
        this.groupedImages[title] = [];
      }
      this.groupedImages[title].push(image);
    });
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'all' ? 'grouped' : 'all';
    if (this.viewMode === 'grouped') {
      this.groupImagesByTags();
    }
  }

  filterByTag(tag: string): void {
    this.selectedTags = [tag];
    this.loadImages(true);
  }

  clearTagFilter(): void {
    this.selectedTags = [];
    this.loadImages(true);
  }

  // Carousel navigation
  nextSlide(): void {
    if (this.featuredImages.length > 0) {
      this.currentSlideIndex = (this.currentSlideIndex + 1) % this.featuredImages.length;
    }
  }

  prevSlide(): void {
    if (this.featuredImages.length > 0) {
      this.currentSlideIndex =
        (this.currentSlideIndex - 1 + this.featuredImages.length) % this.featuredImages.length;
    }
  }

  goToSlide(index: number): void {
    this.currentSlideIndex = index;
  }

  loadMore(): void {
    if (!this.isLoadingMore && this.hasMore) {
      this.currentPage++;
      this.isLoadingMore = true;
      this.loadImages();
    }
  }

  onSearch(): void {
    this.loadImages(true);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.loadImages(true);
  }

  openImage(image: GalleryImage, index: number): void {
    this.dialog.open(ImageLightboxComponent, {
      data: {
        images: this.images,
        currentIndex: index
      },
      maxWidth: '100vw',
      maxHeight: '100vh',
      width: '100%',
      height: '100%',
      panelClass: 'fullscreen-dialog'
    });
  }

  openTitleGroup(title: string): void {
    const groupImages = this.groupedImages[title];
    if (groupImages && groupImages.length > 0) {
      this.dialog.open(ImageLightboxComponent, {
        data: {
          images: groupImages,
          currentIndex: 0
        },
        maxWidth: '100vw',
        maxHeight: '100vh',
        width: '100%',
        height: '100%',
        panelClass: 'fullscreen-dialog'
      });
    }
  }

  navigateToUpload(): void {
    this.router.navigate(['/admin/gallery-upload']);
  }

  // Infinite scroll detection
  @HostListener('window:scroll')
  onScroll(): void {
    const scrollPosition = window.innerHeight + window.scrollY;
    const scrollThreshold = document.documentElement.scrollHeight - 500;

    if (scrollPosition >= scrollThreshold && !this.isLoadingMore && this.hasMore) {
      this.loadMore();
    }
  }

  // Pull-to-refresh simulation
  onRefresh(): void {
    this.loadImages(true);
  }

  trackByImageId(index: number, image: GalleryImage): string {
    return image._id;
  }
}
