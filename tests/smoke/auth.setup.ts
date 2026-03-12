import { test } from './support/fixtures';
import { AUTH_FILE } from './support/smoke-env';
import { loginThroughUi, parkAuthenticatedSession, writeAuthDir } from './support/helpers';

test('store authenticated smoke session', async ({ page }) => {
    await writeAuthDir();
    await loginThroughUi(page);
    await parkAuthenticatedSession(page);
    await page.context().storageState({ path: AUTH_FILE });
});
