// Executed inside Chromium after fonts/images load, so continuation pages use actual sizes.
export function paginateEvs() {
  const sheets = Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet'));
  for (const original of sheets) {
    let sheet = original;
    let flow = sheet.querySelector<HTMLElement>('.evs-flow')!;
    const blocks = Array.from(flow.children);
    flow.replaceChildren();
    for (const block of blocks) {
      flow.append(block);
      if (
        block.getBoundingClientRect().bottom > flow.getBoundingClientRect().bottom + 1 &&
        flow.children.length > 1
      ) {
        block.remove();
        const continuation = original.cloneNode(true) as HTMLElement;
        continuation.querySelector('.evs-flow')!.replaceChildren();
        sheet.after(continuation);
        sheet = continuation;
        flow = sheet.querySelector<HTMLElement>('.evs-flow')!;
        flow.append(block);
      }
      // A pathological single block must never silently run into the next page.
      if (block.getBoundingClientRect().bottom > flow.getBoundingClientRect().bottom + 1)
        throw new Error(
          'Um campo excedeu o espaço de uma página do relatório. Divida o texto em campos menores.',
        );
    }
  }
  const all = Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet'));
  all.forEach((sheet, i) => {
    sheet.querySelector('.evs-page-number')!.textContent =
      String(i + 1).padStart(2, '0') + '/' + String(all.length).padStart(2, '0');
  });
}
