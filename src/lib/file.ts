/** Віддає файл користувачу: на телефоні — через меню «Поділитися», на ПК — завантаженням. */
export async function saveFile(
  name: string,
  text: string,
  type = 'application/json',
): Promise<void> {
  const file = new File([text], name, { type });
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      // Інакше — падаємо на звичайне завантаження.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
