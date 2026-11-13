import { expect } from '@playwright/test';

import { type } from './utils/actions/keyboard.js';
import {
  enterPlaygroundRoom,
  focusRichText,
  initEmptyParagraphState,
} from './utils/actions/misc.js';
import { test } from './utils/playwright.js';

const entries = [
  ['Map view', 'affine-database-workspace-view'],
  ['Vertical bar chart', 'affine-database-workspace-view'],
  ['Horizontal bar chart', 'affine-database-workspace-view'],
  ['Line chart', 'affine-database-workspace-view'],
  ['Donut chart', 'affine-database-workspace-view'],
  ['Number chart', '.workspace-view-number'],
  ['Form', 'affine-database-workspace-view form'],
  ['Database - Inline', 'affine-database'],
  ['Database - Full page', 'affine-embed-linked-doc-block'],
  ['Linked view of data source', 'affine-database-workspace-view'],
] as const;

for (const [command, selector] of entries) {
  test(`inserts ${command} from the slash menu`, async ({ page }) => {
    await enterPlaygroundRoom(page);
    await initEmptyParagraphState(page);
    await focusRichText(page);
    await type(page, '/');
    await page
      .locator('.slash-menu')
      .getByText(command, { exact: true })
      .click();
    await expect(page.locator(selector)).toBeVisible();

    if (command === 'Number chart') {
      await expect(page.locator(selector)).toHaveText('0');
    }
    if (command === 'Database - Full page') {
      await expect(page.locator(selector)).toContainText('Untitled database');
      await expect
        .poll(() =>
          page.evaluate(() => {
            const workspace = window.doc.workspace;
            const meta = workspace.meta.docMetas.find(
              meta => meta.title === 'Untitled database'
            );
            return meta
              ? workspace
                  .getDoc(meta.id)
                  ?.getStore()
                  .getModelsByFlavour('affine:database').length
              : 0;
          })
        )
        .toBe(1);
    }
    if (command === 'Form') {
      const form = page.locator(selector);
      await form.locator('input').first().fill('Offline response');
      await form.getByRole('button', { name: 'Submit' }).click();
      await expect(form.getByRole('status')).toHaveText('Response saved');
      await page
        .locator('affine-database')
        .getByText('Table View', { exact: true })
        .click();
      await expect(
        page.locator('affine-database').getByText('Offline response')
      ).toBeVisible();
    }
  });
}
