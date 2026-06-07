import type { Message } from '@/lib/types';
import {
  buildAssistantMessageCopyText,
  buildStructuredResponseCopyText,
} from '@/lib/message-copy-text';
import {
  buildWebMessageCopyPayload,
  inlineMarkdownToHtml,
  markdownCopyTextToHtml,
} from '@/lib/message-copy-clipboard';

describe('message-copy-text markdown format', () => {
  it('uses markdown link syntax for structured providers', () => {
    const text = buildStructuredResponseCopyText(
      {
        analysis: {
          title: 'Roof leak',
          serviceResults: {
            localPros: {
              serpAPIResults: [
                {
                  name: 'Ace Roofing',
                  contact_info: '555-0100',
                  location: 'Austin, TX',
                  ratings: '4.8',
                  reviews: '120',
                  website: 'https://example.com',
                  directions: '',
                  link: '',
                  authorized: '',
                  additional_information: '',
                },
              ],
            },
          },
        },
      },
      '',
      'markdown'
    );

    expect(text).toContain('[Website](https://example.com)');
    expect(text).not.toContain('Website: https://example.com');
  });
});

describe('message-copy-clipboard', () => {
  it('builds plain whatsapp and html from assistant message', () => {
    const message = {
      id: 'm1',
      role: 'assistant',
      content: '',
      contentMarkdown: 'See [docs](https://example.com/docs).',
      contentJson: {
        analysis: {
          title: 'Test',
          triageResult: { diagnosis: 'Minor wear.' },
        },
      },
    } as Message;

    const payload = buildWebMessageCopyPayload(message);
    expect(payload.plain).toContain('docs: https://example.com/docs');
    expect(payload.markdown).toContain('# Test');
    expect(payload.html).toContain('<a href="https://example.com/docs">docs</a>');
  });

  it('converts inline markdown links to html anchors', () => {
    expect(inlineMarkdownToHtml('Read [guide](https://example.com)')).toContain(
      '<a href="https://example.com">guide</a>'
    );
  });

  it('converts product links with spaces in google shopping urls', () => {
    const googleUrl =
      'https://www.google.com/search?ibp=oshop&q=garage door primer&prds=catalogid:10790422449815296405,productid:7394705878427734806&udm=28';
    const html = inlineMarkdownToHtml(`[KILZ 2 Primer](${googleUrl})`);
    expect(html).toContain('<a href="');
    expect(html).toContain('KILZ 2 Primer</a>');
    expect(html).toContain('garage%20door%20primer');
    expect(html).not.toMatch(/\[KILZ 2 Primer\]/);
  });

  it('renders recommended product markdown as clickable html', () => {
    const googleUrl =
      'https://www.google.com/search?ibp=oshop&q=grey exterior paint&prds=catalogid:4067308526379588970&udm=28';
    const text = buildStructuredResponseCopyText(
      {
        analysis: {
          title: 'Paint job',
          diyResults: {
            recommendedProducts: {
              products: [
                {
                  item_name: 'RUST-OLEUM STOPS RUST Protective Enamel',
                  price: '$17.48',
                  vendor: 'Home Depot',
                  url: googleUrl,
                },
              ],
            },
          },
        },
      },
      '',
      'markdown'
    );
    const html = markdownCopyTextToHtml(text);
    expect(html).toContain('<a href="');
    expect(html).toContain('RUST-OLEUM STOPS RUST Protective Enamel</a>');
    expect(html).not.toContain('[RUST-OLEUM');
  });

  it('converts headings to html with Gmail-friendly fragment wrapper', () => {
    const html = markdownCopyTextToHtml('## Summary\n\nHello **world**.');
    expect(html).toContain('<!--StartFragment-->');
    expect(html).toContain('<!--EndFragment-->');
    expect(html).toContain('<h2>Summary</h2>');
    expect(html).toContain('<div>Hello <strong>world</strong>.</div>');
    expect(html).not.toContain('<br/>');
    expect(html).not.toContain('<p>');
  });

  it('uses div per line for multiline blocks', () => {
    const html = markdownCopyTextToHtml('Line one\nLine two');
    expect(html).toContain('<div>Line one</div><div>Line two</div>');
  });

  it('uses markdown export for structured assistant copy', () => {
    const message = {
      id: 'm2',
      role: 'assistant',
      content: '',
      contentJson: {
        analysis: {
          title: 'Garage door',
          triageResult: { diagnosis: 'Worn rollers.' },
        },
      },
    } as Message;

    expect(buildAssistantMessageCopyText(message, 'markdown')).toContain('# Garage door');
  });
});
