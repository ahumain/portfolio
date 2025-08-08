// Navigation mobile
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('no-scroll', navMenu.classList.contains('active'));
        });

        // Fermer le menu mobile lors du clic sur un lien
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.classList.remove('no-scroll');
            });
        });
    }

    // Animation des barres de compétences (fiable sur mobile)
    const skillBars = document.querySelectorAll('.skill-progress');
    const animateSkills = () => {
        skillBars.forEach(bar => {
            const width = bar.getAttribute('data-width');
            if (width) bar.style.width = width;
        });
    };
    // Observer dédié par item pour garantir l'animation sur mobile
    const skillItems = document.querySelectorAll('.skill-item');
    if ('IntersectionObserver' in window && skillItems.length) {
        const skillsObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const bar = entry.target.querySelector('.skill-progress');
                    if (bar) {
                        const width = bar.getAttribute('data-width');
                        if (width) bar.style.width = width;
                    }
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

        skillItems.forEach(item => skillsObserver.observe(item));
    } else {
        // Fallback si IntersectionObserver indisponible
        setTimeout(animateSkills, 400);
    }

    // Observer pour les effets d'apparition (séparé des skills)
    if ('IntersectionObserver' in window) {
        const appearObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    appearObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

        document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right').forEach(el => {
            appearObserver.observe(el);
        });
    }

    // Sécurité supplémentaire: si la section skills est déjà visible au chargement, anime directement
    const skillsSection = document.querySelector('.skills');
    if (skillsSection) {
        const rect = skillsSection.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            setTimeout(animateSkills, 300);
        }
    }

    // Fallbacks supplémentaires pour mobiles (Safari/iOS)
    const ensureSkillsColored = utils.debounce(() => {
        // Si au moins une barre n'est pas encore remplie, relancer l'animation
        const needs = Array.from(skillBars).some(bar => parseFloat(getComputedStyle(bar).width) < 5);
        if (needs) animateSkills();
    }, 200);

    window.addEventListener('pageshow', () => setTimeout(ensureSkillsColored, 300));
    window.addEventListener('resize', ensureSkillsColored);
    window.addEventListener('orientationchange', () => setTimeout(ensureSkillsColored, 200));

    // Scroll doux pour les liens d'ancrage
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Filtrage des projets
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Retirer la classe active de tous les boutons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Ajouter la classe active au bouton cliqué
            button.classList.add('active');

            const filter = button.getAttribute('data-filter');

            projectCards.forEach(card => {
                if (filter === 'all' || card.getAttribute('data-category') === filter) {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 100);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            });
        });
    });

    // Formulaire de contact
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');

    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            
            // Validation côté client
            if (!data.name || !data.email || !data.message) {
                showMessage('Veuillez remplir tous les champs obligatoires.', 'error');
                return;
            }
            
            // Validation email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                showMessage('Veuillez entrer une adresse email valide.', 'error');
                return;
            }
            
            // Ajouter un état de chargement
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner"></span> Envoi en cours...';
            submitBtn.disabled = true;
            
            // Désactiver le formulaire pendant l'envoi
            const inputs = this.querySelectorAll('input, textarea');
            inputs.forEach(input => input.disabled = true);

            try {
                const response = await fetch('/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    showMessage(result.message || 'Message envoyé avec succès! Vous recevrez une confirmation par email.', 'success');
                    this.reset();
                    
                    // Afficher un message de suivi
                    setTimeout(() => {
                        showMessage('💡 Vérifiez votre boîte email pour la confirmation !', 'info');
                    }, 3000);
                } else {
                    showMessage(result.message || 'Erreur lors de l\'envoi du message. Veuillez réessayer.', 'error');
                }
            } catch (error) {
                console.error('Erreur réseau:', error);
                showMessage('Erreur de connexion. Veuillez vérifier votre connexion internet et réessayer.', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                inputs.forEach(input => input.disabled = false);
            }
        });
    }

    function showMessage(message, type) {
        if (formMessage) {
            formMessage.textContent = message;
            formMessage.className = `form-message ${type}`;
            formMessage.style.display = 'block';
            
            // Auto-hide après un délai selon le type
            const hideDelay = type === 'success' ? 8000 : type === 'info' ? 5000 : 6000;
            setTimeout(() => {
                formMessage.style.opacity = '0';
                setTimeout(() => {
                    formMessage.style.display = 'none';
                    formMessage.style.opacity = '1';
                }, 300);
            }, hideDelay);
        }
    }

    // Navbar avec effet de transparence au scroll
    const navbar = document.querySelector('.navbar');
    let lastScrollTop = 0;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.backdropFilter = 'blur(10px)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        }

        // Cacher/afficher la navbar selon la direction du scroll
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        lastScrollTop = scrollTop;
    });

    // Effet parallax pour le hero (désactivé pour éviter le chevauchement des sections)
    const hero = document.querySelector('.hero');
    if (hero) {
        // S'assurer qu'aucune transformation n'est appliquée
        hero.style.transform = '';
    }

    // Typing effect pour le titre principal
    const typedElement = document.querySelector('.hero-text h1');
    if (typedElement) {
        const text = typedElement.textContent;
        typedElement.textContent = '';
        
        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                typedElement.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        };
        
        setTimeout(typeWriter, 1000);
    }

    // Compteur animé pour les statistiques
    const stats = document.querySelectorAll('.stat-item h3');
    const animateCounters = () => {
        stats.forEach(stat => {
            const target = parseInt(stat.textContent);
            const increment = target / 100;
            let current = 0;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    stat.textContent = target + '+';
                    clearInterval(timer);
                } else {
                    stat.textContent = Math.ceil(current) + '+';
                }
            }, 20);
        });
    };

    // Observer pour les stats
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        statsObserver.observe(statsSection);
    }

    // Lazy loading des images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));

    // Ajout d'une classe pour les animations CSS au chargement
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);

    // Auto-resize de l'iframe FAQ
    const faqFrame = document.getElementById('faqFrame');
    const resizeFaq = () => {
        if (!faqFrame) return;
        try {
            const doc = faqFrame.contentDocument || faqFrame.contentWindow.document;
            if (!doc) return;
            const height = doc.documentElement.scrollHeight || doc.body.scrollHeight;
            if (height) faqFrame.style.height = Math.min(Math.max(height, 500), 3000) + 'px';
        } catch (e) {
            // cross-origin safety (not expected here)
        }
    };
    if (faqFrame) {
        faqFrame.addEventListener('load', () => {
            resizeFaq();
            // Re-ajuster après un petit délai pour les polices/assets
            setTimeout(resizeFaq, 200);
            setTimeout(resizeFaq, 600);
        });
        window.addEventListener('resize', utils.debounce(resizeFaq, 150));
    }

    // Gestion des tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = this.dataset.tooltip;
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
            tooltip.style.left = rect.left + (rect.width - tooltip.offsetWidth) / 2 + 'px';
        });
        
        element.addEventListener('mouseleave', function() {
            const tooltip = document.querySelector('.tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
    });

    // Mode sombre (optionnel)
    const darkModeToggle = document.querySelector('.dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
        });

        // Charger le mode sombre depuis localStorage
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
        }
    }

    // Validation en temps réel du formulaire
    const formInputs = document.querySelectorAll('.contact-form input, .contact-form textarea');
    formInputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearValidation);
    });

    function validateField(e) {
        const field = e.target;
        const value = field.value.trim();
        
        // Retirer les anciennes validations
        field.classList.remove('error', 'success');
        
        if (field.hasAttribute('required') && !value) {
            field.classList.add('error');
            return false;
        }
        
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                field.classList.add('error');
                return false;
            }
        }
        
        if (value) {
            field.classList.add('success');
        }
        
        return true;
    }

    function clearValidation(e) {
        e.target.classList.remove('error', 'success');
    }

    // Easter egg - Konami Code
    let konamiCode = [];
    const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    
    document.addEventListener('keydown', (e) => {
        konamiCode.push(e.code);
        if (konamiCode.length > konamiSequence.length) {
            konamiCode.shift();
        }
        
        if (konamiCode.join(',') === konamiSequence.join(',')) {
            // Effet spécial
            document.body.style.transform = 'rotate(360deg)';
            document.body.style.transition = 'transform 2s ease';
            setTimeout(() => {
                document.body.style.transform = '';
                alert('🎉 Code Konami activé ! Vous avez trouvé l\'easter egg !');
            }, 2000);
            konamiCode = [];
        }
    });
});

// Utilitaires
const utils = {
    // Debounce function
    debounce: function(func, wait, immediate) {
        let timeout;
        return function executedFunction() {
            const context = this;
            const args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    },

    // Throttle function
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Smooth scroll to element
    scrollTo: function(element, duration = 1000) {
        const targetPosition = element.offsetTop - 70; // Account for navbar
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const run = ease(timeElapsed, startPosition, distance, duration);
            window.scrollTo(0, run);
            if (timeElapsed < duration) requestAnimationFrame(animation);
        }

        function ease(t, b, c, d) {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        }

        requestAnimationFrame(animation);
    }
};

// Exportation pour utilisation dans d'autres scripts
window.portfolioUtils = utils;
