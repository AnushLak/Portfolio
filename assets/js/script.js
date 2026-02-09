'use strict';

document.querySelectorAll('figure.project-img video').forEach(v=>{
  v.addEventListener('click', e => e.stopPropagation());
});

// element toggle function
const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }



// Dot slider navigation + auto/drag for testimonials
const testimonialsDots = document.querySelectorAll('[data-testimonials-dots] .dot');
const testimonialsSlides = document.querySelectorAll('[data-testimonials-list] .testimonials-item');
const testimonialsSlider = document.querySelector('[data-testimonials-slider]');

let testimonialIndex = 0;
let testimonialsAutoTimer = null;
let isDraggingTestimonials = false;
let dragMovedTestimonials = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartTime = 0;

const setTestimonialIndex = (index) => {
  testimonialIndex = (index + testimonialsSlides.length) % testimonialsSlides.length;

  testimonialsDots.forEach(d => d.classList.remove('active'));
  testimonialsSlides.forEach(s => s.classList.remove('active'));

  if (testimonialsDots[testimonialIndex]) {
    testimonialsDots[testimonialIndex].classList.add('active');
  }
  if (testimonialsSlides[testimonialIndex]) {
    testimonialsSlides[testimonialIndex].classList.add('active');
  }
};

const nextTestimonial = () => setTestimonialIndex(testimonialIndex + 1);
const prevTestimonial = () => setTestimonialIndex(testimonialIndex - 1);

const startTestimonialsAuto = () => {
  if (!testimonialsSlides.length) return;
  clearInterval(testimonialsAutoTimer);
  testimonialsAutoTimer = setInterval(nextTestimonial, 3000);
};

const stopTestimonialsAuto = () => {
  clearInterval(testimonialsAutoTimer);
};

testimonialsDots.forEach((dot, index) => {
  dot.addEventListener('click', () => {
    setTestimonialIndex(index);
    startTestimonialsAuto();
  });
});

if (testimonialsSlides.length) {
  setTestimonialIndex(0);
  startTestimonialsAuto();
}

if (testimonialsSlider) {
  const onPointerDown = (e) => {
    isDraggingTestimonials = true;
    dragMovedTestimonials = false;
    dragStartX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    dragStartY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    dragStartTime = Date.now();
    stopTestimonialsAuto();
  };

  const onPointerMove = (e) => {
    if (!isDraggingTestimonials) return;
    const currentX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const currentY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const deltaX = currentX - dragStartX;
    const deltaY = currentY - dragStartY;

    if (Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) {
      dragMovedTestimonials = true;
      e.preventDefault();
    }
  };

  const onPointerUp = (e) => {
    if (!isDraggingTestimonials) return;
    isDraggingTestimonials = false;

    const endX = e.clientX ?? (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
    const deltaX = endX - dragStartX;
    const elapsed = Date.now() - dragStartTime;
    const swipeThreshold = 50;

    if (Math.abs(deltaX) > swipeThreshold && elapsed < 1200) {
      if (deltaX < 0) {
        nextTestimonial();
      } else {
        prevTestimonial();
      }
    }

    startTestimonialsAuto();
  };

  testimonialsSlider.addEventListener('mousedown', onPointerDown);
  testimonialsSlider.addEventListener('mousemove', onPointerMove);
  testimonialsSlider.addEventListener('mouseup', onPointerUp);
  testimonialsSlider.addEventListener('mouseleave', () => {
    if (isDraggingTestimonials) {
      isDraggingTestimonials = false;
      startTestimonialsAuto();
    }
  });

  testimonialsSlider.addEventListener('touchstart', onPointerDown, { passive: true });
  testimonialsSlider.addEventListener('touchmove', onPointerMove, { passive: false });
  testimonialsSlider.addEventListener('touchend', onPointerUp);

  testimonialsSlider.addEventListener('mouseenter', stopTestimonialsAuto);
  testimonialsSlider.addEventListener('mouseleave', startTestimonialsAuto);
}



// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () { elementToggleFunc(sidebar); });



// testimonials variables
const testimonialsItem = document.querySelectorAll("[data-testimonials-item]");
const modalContainer = document.querySelector("[data-modal-container]");
const modalCloseBtn = document.querySelector("[data-modal-close-btn]");
const overlay = document.querySelector("[data-overlay]");

// modal variable
const modalImg = document.querySelector("[data-modal-img]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalText = document.querySelector("[data-modal-text]");

// modal toggle function
const testimonialsModalFunc = function () {
  modalContainer.classList.toggle("active");
  overlay.classList.toggle("active");
}

// add click event to all modal items
for (let i = 0; i < testimonialsItem.length; i++) {

  testimonialsItem[i].addEventListener("click", function (e) {
    if (dragMovedTestimonials) {
      dragMovedTestimonials = false;
      return;
    }

    modalImg.src = this.querySelector("[data-testimonials-avatar]").src;
    modalImg.alt = this.querySelector("[data-testimonials-avatar]").alt;
    modalTitle.innerHTML = this.querySelector("[data-testimonials-title]").innerHTML;
    modalText.innerHTML = this.querySelector("[data-testimonials-text]").innerHTML;

    testimonialsModalFunc();

  });

}

// add click event to modal close button
modalCloseBtn.addEventListener("click", testimonialsModalFunc);
overlay.addEventListener("click", testimonialsModalFunc);



// custom select variables
const select = document.querySelector("[data-select]");
const selectItems = document.querySelectorAll("[data-select-item]");
const selectValue = document.querySelector("[data-selecct-value]");
const filterBtn = document.querySelectorAll("[data-filter-btn]");

select.addEventListener("click", function () { elementToggleFunc(this); });

// add event in all select items
for (let i = 0; i < selectItems.length; i++) {
  selectItems[i].addEventListener("click", function () {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    elementToggleFunc(select);
    filterFunc(selectedValue);

  });
}

// filter variables
const filterItems = document.querySelectorAll("[data-filter-item]");

const filterFunc = function (selectedValue) {

  for (let i = 0; i < filterItems.length; i++) {

    if (selectedValue === "all") {
      filterItems[i].classList.add("active");
    } else {
      const rawCategories = filterItems[i].dataset.category || "";
      const categories = rawCategories
        .split(",")
        .map(category => category.trim().toLowerCase())
        .filter(Boolean);

      if (categories.includes(selectedValue)) {
        filterItems[i].classList.add("active");
      } else {
        filterItems[i].classList.remove("active");
      }
    }

  }

}

// add event in all filter button items for large screen
let lastClickedBtn = filterBtn[0];

for (let i = 0; i < filterBtn.length; i++) {

  filterBtn[i].addEventListener("click", function () {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    filterFunc(selectedValue);

    lastClickedBtn.classList.remove("active");
    this.classList.add("active");
    lastClickedBtn = this;

  });

}



// contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");

// add event to all form input field
for (let i = 0; i < formInputs.length; i++) {
  formInputs[i].addEventListener("input", function () {

    // check form validation
    if (form.checkValidity()) {
      formBtn.removeAttribute("disabled");
    } else {
      formBtn.setAttribute("disabled", "");
    }

  });
}

// Formspree form submission handler
const contactForm = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');

if (contactForm) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();

    // Disable button and show loading state
    formBtn.disabled = true;
    formBtn.querySelector('span').textContent = 'Sending...';

    // Get form data
    const formData = new FormData(this);

    // Send to Formspree
    fetch(this.action, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(response => {
      if (response.ok) {
        // Success
        formStatus.style.display = 'block';
        formStatus.style.color = '#10b981';
        formStatus.textContent = 'Message sent successfully! I\'ll get back to you soon.';
        contactForm.reset();
        formBtn.querySelector('span').textContent = 'Send Message';
        formBtn.disabled = true;

        // Hide status after 5 seconds
        setTimeout(() => {
          formStatus.style.display = 'none';
        }, 5000);
      } else {
        throw new Error('Form submission failed');
      }
    })
    .catch(error => {
      // Error
      formStatus.style.display = 'block';
      formStatus.style.color = '#ef4444';
      formStatus.textContent = 'Failed to send message. Please try again or email directly.';
      formBtn.querySelector('span').textContent = 'Send Message';
      formBtn.disabled = false;
      console.error('Formspree error:', error);
    });
  });
}



// page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

// add event to all nav link with smooth transition
for (let i = 0; i < navigationLinks.length; i++) {
  navigationLinks[i].addEventListener("click", function () {
    const clickedNav = this;
    const targetPage = clickedNav.innerHTML.toLowerCase();

    // Find current active page and target page
    let currentPage = null;
    let newPage = null;

    for (let j = 0; j < pages.length; j++) {
      if (pages[j].classList.contains("active")) {
        currentPage = pages[j];
      }
      if (targetPage === pages[j].dataset.page) {
        newPage = pages[j];
      }
    }

    // If clicking on same tab, do nothing
    if (currentPage === newPage) return;

    // Update nav links immediately - simple approach
    navigationLinks.forEach(link => {
      if (link === clickedNav) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Smooth transition
    if (currentPage) {
      currentPage.classList.add("fade-out");

      setTimeout(() => {
        currentPage.classList.remove("active", "fade-out");
        if (newPage) {
          newPage.classList.add("active");
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 300);
    } else if (newPage) {
      newPage.classList.add("active");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}



// Service items click to navigate to portfolio with filter
const serviceItems = document.querySelectorAll("[data-service-link]");

serviceItems.forEach(serviceItem => {
  serviceItem.addEventListener("click", function() {
    const category = this.dataset.serviceLink;

    // Find the Portfolio nav link and click it
    const portfolioNavLink = document.querySelector('[data-nav-link]:nth-child(1)');
    let targetNavLink = null;

    navigationLinks.forEach(link => {
      if (link.innerHTML.toLowerCase() === 'projects') {
        targetNavLink = link;
      }
    });

    if (targetNavLink) {
      // Trigger the nav link click
      targetNavLink.click();

      // After the page transition, apply the filter
      setTimeout(() => {
        // Update filter buttons
        filterBtn.forEach(btn => {
          const btnText = btn.innerText.toLowerCase();
          if (btnText === category) {
            btn.classList.add("active");
            lastClickedBtn.classList.remove("active");
            lastClickedBtn = btn;
            selectValue.innerText = btn.innerText;
          }
        });

        // Apply filter to projects
        filterFunc(category);
      }, 400);
    }
  });
});



// Expandable project cards functionality
const projectCards = document.querySelectorAll('[data-project-card]');

projectCards.forEach(card => {
  const header = card.querySelector('[data-project-toggle]');
  const video = card.querySelector('video');
  const pdfLinks = card.querySelectorAll('.pdf-preview');

  if (header) {
    header.addEventListener('click', () => {
      // Toggle expanded state
      card.classList.toggle('expanded');

      // Pause video when collapsing
      if (!card.classList.contains('expanded') && video) {
        video.pause();
      }
    });
  }

  // Prevent video controls from triggering card collapse
  if (video) {
    video.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Prevent PDF links from triggering card collapse
  pdfLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
});

// Rotating greeting in About section
const rotatingGreeting = document.querySelector('[data-rotating-greeting]');

if (rotatingGreeting) {
  const greetings = [
    
    "Hello",
    "Hola",
    "Bonjour",
    "नमस्ते",
    "Vanakkam",
    // "வணக்கம்"
  ];

  let greetingIndex = 0;
  const rotationDelay = 3000;
  const fadeDuration = 350;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const measureSpan = rotatingGreeting.cloneNode(true);
  measureSpan.style.position = "absolute";
  measureSpan.style.visibility = "hidden";
  measureSpan.style.pointerEvents = "none";
  measureSpan.style.whiteSpace = "nowrap";
  document.body.appendChild(measureSpan);

  let maxWidth = 0;
  greetings.forEach(text => {
    measureSpan.textContent = text;
    maxWidth = Math.max(maxWidth, measureSpan.getBoundingClientRect().width);
  });

  document.body.removeChild(measureSpan);
  if (maxWidth > 0) {
    rotatingGreeting.style.minWidth = `${Math.ceil(maxWidth)}px`;
  }

  if (!prefersReducedMotion) {
    setInterval(() => {
      rotatingGreeting.classList.add("is-fading");

      window.setTimeout(() => {
        greetingIndex = (greetingIndex + 1) % greetings.length;
        rotatingGreeting.textContent = greetings[greetingIndex];
        rotatingGreeting.classList.remove("is-fading");
      }, fadeDuration);
    }, rotationDelay);
  }
}



// PDF.js - Render first page of PDFs as previews
if (typeof pdfjsLib !== 'undefined') {
  // Set the worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  // Find all PDF preview elements
  const pdfPreviews = document.querySelectorAll('.pdf-preview[data-pdf-src]');

  pdfPreviews.forEach(preview => {
    const pdfSrc = preview.getAttribute('data-pdf-src');
    const canvas = preview.querySelector('.pdf-canvas');

    if (!pdfSrc || !canvas) return;

    // Add loading class
    preview.classList.add('loading');

    // Load and render the PDF
    pdfjsLib.getDocument(pdfSrc).promise.then(pdf => {
      // Get the first page
      return pdf.getPage(1);
    }).then(page => {
      // Set up canvas scaling
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render the page
      const context = canvas.getContext('2d');
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      return page.render(renderContext).promise;
    }).then(() => {
      // Remove loading class when done
      preview.classList.remove('loading');
    }).catch(error => {
      console.error('Error loading PDF:', pdfSrc, error);
      preview.classList.remove('loading');
      // Show fallback icon on error
      canvas.style.display = 'none';
      preview.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 180px; background: linear-gradient(135deg, hsla(217, 91%, 60%, 0.1), hsla(262, 83%, 58%, 0.1)); padding: 20px;">
          <ion-icon name="document-text-outline" style="font-size: 40px; color: var(--orange-yellow-crayola);"></ion-icon>
          <span style="margin-top: 10px; color: var(--light-gray); font-size: 12px;">Click to view PDF</span>
        </div>
      `;
    });
  });
}
