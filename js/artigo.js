// Botão "copiar" dos blocos de código. Sem JS o botão continua escondido
// (atributo hidden no HTML) e o código continua selecionável normalmente.

for (const block of document.querySelectorAll('.code')) {
  const btn = block.querySelector('.code-copy');
  if (!btn || !navigator.clipboard) continue;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(block.querySelector('code').innerText);
      btn.textContent = 'copiado';
    } catch {
      btn.textContent = 'falhou';
    }
    setTimeout(() => (btn.textContent = 'copiar'), 1500);
  });
}
