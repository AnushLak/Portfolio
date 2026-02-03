'use strict';

document.querySelectorAll('figure.project-img video').forEach(v=>{
  v.addEventListener('click', e => e.stopPropagation());
});

// element toggle function
const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }



// Dot slider navigation for testimonials
const testimonialsDots = document.querySelectorAll('[data-testimonials-dots] .dot');
const testimonialsSlides = document.querySelectorAll('[data-testimonials-list] .testimonials-item');

testimonialsDots.forEach((dot, index) => {
  dot.addEventListener('click', () => {
    // Remove active from all
    testimonialsDots.forEach(d => d.classList.remove('active'));
    testimonialsSlides.forEach(s => s.classList.remove('active'));

    // Add active to clicked
    dot.classList.add('active');
    if (testimonialsSlides[index]) {
      testimonialsSlides[index].classList.add('active');
    }
  });
});



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

  testimonialsItem[i].addEventListener("click", function () {

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
    } else if (selectedValue === filterItems[i].dataset.category) {
      filterItems[i].classList.add("active");
    } else {
      filterItems[i].classList.remove("active");
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