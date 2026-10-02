import type { VkMarkdownPipeline } from 'markdown-to-vk';

import { removeNestedDuplicateVkFormatEntities } from './vk-html-text.util';

type MarkdownToVkModule = {
  createMarkdownToVkPipeline(): VkMarkdownPipeline;
};

/**
 * `markdown-to-vk` — ESM-only dev-зависимость, а основной проект собран в
 * CommonJS. `new Function` сохраняет нативный dynamic import для Jest.
 */
async function loadMarkdownToVk(): Promise<MarkdownToVkModule> {
  const importEsm = new Function('moduleName', 'return import(moduleName)') as (
    moduleName: string,
  ) => Promise<MarkdownToVkModule>;

  return await importEsm('markdown-to-vk');
}

describe('markdown-to-vk compatibility', () => {
  it('removes a nested repeated style that makes VK ignore format_data', async () => {
    const { createMarkdownToVkPipeline } = await loadMarkdownToVk();
    const [chunk] = createMarkdownToVkPipeline().render(
      '> 🧪 Markdown: цитата с **жирным** и _курсивом_.',
    );

    expect(chunk).toMatchObject({
      text: '> 🧪 Markdown: цитата с жирным и курсивом.',
      items: [
        { type: 'italic', offset: 0, length: 42 },
        { type: 'bold', offset: 24, length: 6 },
        { type: 'italic', offset: 33, length: 8 },
      ],
    });
    expect(removeNestedDuplicateVkFormatEntities(chunk.items)).toEqual([
      { type: 'italic', offset: 0, length: 42 },
      { type: 'bold', offset: 24, length: 6 },
    ]);
  });
});
