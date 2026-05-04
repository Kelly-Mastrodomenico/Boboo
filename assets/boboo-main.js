/**
 * BOBOÓ — JavaScript principal
 * Archivo: assets/boboo-main.js
 * Sesión: 1 — Sistema de marca base
 *
 * REGLAS DE ESTE ARCHIVO:
 * · CSS maneja todos los estados visuales. JS solo alterna clases.
 * · Vanilla JS puro — cero librerías externas.
 * · Cargado con defer → no bloquea render.
 * · GSAP reservado para boboo-gsap.js (animaciones de scroll complejas).
 * · Guardia obligatoria: si window.self !== window.top, no lanzar
 *   animaciones. El editor de temas de Shopify usa un iframe.
 */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     GUARDIA — Editor de temas de Shopify (iframe)
     Si el script corre dentro de un iframe (editor del tema),
     no inicializamos nada que dependa de scroll o viewport.
  ────────────────────────────────────────────────────────── */
  const enIframe = window.self !== window.top;

  /* Preferencia de movimiento reducido */
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ──────────────────────────────────────────────────────────
     1. CURSOR PERSONALIZADO
     ~25 líneas vanilla, cero librerías.
     El lag (factor 0.15) da el efecto de inercia sin GSAP.
     Solo en dispositivos con puntero fino (ratón/trackpad).
  ────────────────────────────────────────────────────────── */
  function iniciarCursor() {
    /* No inicializar en táctil ni si el usuario prefiere sin movimiento */
    if (window.matchMedia('(pointer: coarse)').matches || sinMovimiento) return;

    const cursor = document.createElement('div');
    cursor.className = 'boboo-cursor';
    document.body.appendChild(cursor);

    /* Activar clase en body para ocultar cursor nativo */
    document.body.classList.add('boboo-cursor-active');

    let mx = 0, my = 0, cx = 0, cy = 0;

    /* Seguir posición del ratón */
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX;
      my = e.clientY;
      cursor.classList.remove('boboo-cursor--hidden');
    });

    /* Ocultar al salir de la ventana */
    document.addEventListener('mouseleave', function () {
      cursor.classList.add('boboo-cursor--hidden');
    });

    /* Loop de animación — math puro, sin GSAP */
    (function loop() {
      /* Interpolación lineal (lerp): mueve el cursor hacia la posición real */
      cx += (mx - cx) * 0.15;
      cy += (my - cy) * 0.15;
      /* translate(-50%,-50%) centra el punto del cursor */
      cursor.style.transform = 'translate(calc(' + cx + 'px - 50%), calc(' + cy + 'px - 50%))';
      requestAnimationFrame(loop);
    })();

    /* Expandir cursor en elementos interactivos */
    const objetivos = 'a, button, .product-card, .card-wrapper, input, select, textarea, [role="button"]';

    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(objetivos)) {
        cursor.classList.add('boboo-cursor--hover');
      }
    });

    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(objetivos)) {
        cursor.classList.remove('boboo-cursor--hover');
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     2. SCROLL SHRINK DEL HEADER
     Añade la clase .boboo-scrolled al header-component cuando
     el usuario ha scrollado más de 60px.
     CSS en boboo-custom.css gestiona el cambio visual.
     Sin GSAP: CSS transition es suficiente para este efecto.
  ────────────────────────────────────────────────────────── */
  function iniciarScrollShrink() {
    /* Buscar el header con el atributo Boboó */
    const header = document.querySelector('[data-boboo-header]');
    if (!header) return;

    const UMBRAL = 60; /* px antes de activar estado compacto */
    let animFramePendiente = false;

    function actualizarHeader() {
      if (window.scrollY > UMBRAL) {
        header.classList.add('boboo-scrolled');
      } else {
        header.classList.remove('boboo-scrolled');
      }
      animFramePendiente = false;
    }

    window.addEventListener('scroll', function () {
      /* Throttle via requestAnimationFrame — máximo 1 update por frame */
      if (!animFramePendiente) {
        animFramePendiente = true;
        requestAnimationFrame(actualizarHeader);
      }
    }, { passive: true });

    /* Ejecutar al cargar por si la página empieza scrollada */
    actualizarHeader();
  }

  /* ──────────────────────────────────────────────────────────
     3. TILT 3D EN ELEMENTOS .tilt-card
     CSS gestiona perspective y transform-style.
     JS solo lee posición del ratón y actualiza transform.
     No se aplica en tarjetas del grid de producto (conflicto
     con quick-view de Horizon).
     Solo en desktop con pointer:fine.
  ────────────────────────────────────────────────────────── */
  function iniciarTilt() {
    if (window.matchMedia('(pointer: coarse)').matches || sinMovimiento) return;

    document.querySelectorAll('.tilt-card').forEach(function (card) {
      card.style.willChange = 'transform';
      card.style.transition = 'transform .1s ease';

      card.addEventListener('mousemove', function (e) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) / r.width;
        const y = (e.clientY - r.top - r.height / 2) / r.height;
        /* Máximo 8 grados de inclinación */
        card.style.transform =
          'perspective(800px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg) scale(1.02)';
      });

      card.addEventListener('mouseleave', function () {
        /* Resorte al soltar */
        card.style.transition = 'transform .6s cubic-bezier(.34,1.56,.64,1)';
        card.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)';
        /* Restaurar transición rápida para el siguiente hover */
        setTimeout(function () {
          card.style.transition = 'transform .1s ease';
        }, 600);
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     4. SCROLL REVEAL — IntersectionObserver
     Observa elementos con clase .boboo-reveal.
     Añade .visible cuando entran en viewport (umbral 15%).
     Se deja de observar tras activar (animación una sola vez).
     Sin GSAP: CSS transition es suficiente.
  ────────────────────────────────────────────────────────── */
  function iniciarScrollReveal() {
    if (sinMovimiento) return;

    const elementos = document.querySelectorAll('.boboo-reveal');
    if (!elementos.length) return;

    const observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('visible');
            /* Dejar de observar — la animación solo ocurre una vez */
            observador.unobserve(entrada.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    elementos.forEach(function (el) {
      observador.observe(el);
    });
  }

  /* ──────────────────────────────────────────────────────────
     5. PRODUCTOS VISTOS RECIENTEMENTE
     Guarda los IDs de productos vistos en localStorage.
     Clave: 'boboo_visited' — máximo 12 productos.
     Se usa en la sección boboo-visited.liquid para mostrar
     un carrusel de productos ya vistos.
  ────────────────────────────────────────────────────────── */
  function registrarProductoVisto() {
    /* Solo en páginas de producto */
    const esPaginaProducto = document.body.dataset.template === 'product' ||
      document.querySelector('[data-product-id]');

    if (!esPaginaProducto) return;

    const idEl = document.querySelector('[data-product-id]');
    if (!idEl) return;

    const idProducto = idEl.dataset.productId;
    if (!idProducto) return;

    try {
      const CLAVE = 'boboo_visited';
      const MAX = 12;
      let vistos = JSON.parse(localStorage.getItem(CLAVE) || '[]');

      /* Eliminar si ya existe para moverlo al principio */
      vistos = vistos.filter(function (id) { return id !== idProducto; });
      vistos.unshift(idProducto);

      /* Mantener máximo 12 */
      if (vistos.length > MAX) vistos = vistos.slice(0, MAX);

      localStorage.setItem(CLAVE, JSON.stringify(vistos));
    } catch (e) {
      /* localStorage puede estar bloqueado en modo privado */
    }
  }

  /* ──────────────────────────────────────────────────────────
     6. LOGO TILT 3D (en el header)
     Similar al tilt de tarjetas pero más sutil.
     Se aplica al logo en el header al pasar el ratón.
  ────────────────────────────────────────────────────────── */
  function iniciarLogoTilt() {
    if (window.matchMedia('(pointer: coarse)').matches || sinMovimiento) return;

    const logo = document.querySelector('[data-boboo-header] .header__logo');
    if (!logo) return;

    logo.style.display = 'inline-block';
    logo.style.transition = 'transform .1s ease';
    logo.style.willChange = 'transform';

    logo.addEventListener('mousemove', function (e) {
      const r = logo.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      logo.style.transform =
        'perspective(800px) rotateY(' + (x * 12) + 'deg) rotateX(' + (-y * 12) + 'deg)';
    });

    logo.addEventListener('mouseleave', function () {
      logo.style.transition = 'transform .6s cubic-bezier(.34,1.56,.64,1)';
      logo.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg)';
      setTimeout(function () { logo.style.transition = 'transform .1s ease'; }, 600);
    });
  }

  /* ──────────────────────────────────────────────────────────
     INICIALIZACIÓN
     Se lanza cuando el DOM está listo.
     Las funciones que dependen de scroll/viewport se saltan
     si estamos dentro de un iframe (editor de temas).
  ────────────────────────────────────────────────────────── */
  function init() {
    /* El cursor y el logo tilt se inicializan siempre (no dependen de scroll) */
    iniciarCursor();

    if (enIframe) return;

    iniciarScrollShrink();
    iniciarScrollReveal();
    iniciarTilt();
    iniciarLogoTilt();
    registrarProductoVisto();
  }

  /* Esperar a que el DOM esté listo */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
