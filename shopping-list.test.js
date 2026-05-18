const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, 'shopping-list.html').replace(/\\/g, '/');

let browser, page;
let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || '조건 불충족');
}

async function resetPage() {
  await page.goto(FILE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();

  console.log('\n📋 아이템 추가');

  await test('버튼 클릭으로 아이템 추가', async () => {
    await resetPage();
    await page.fill('#item-input', '사과');
    await page.click('.input-row button');
    const text = await page.textContent('.item-name');
    assert(text === '사과', `예상: "사과", 실제: "${text}"`);
  });

  await test('Enter 키로 아이템 추가', async () => {
    await resetPage();
    await page.fill('#item-input', '바나나');
    await page.press('#item-input', 'Enter');
    const text = await page.textContent('.item-name');
    assert(text === '바나나', `예상: "바나나", 실제: "${text}"`);
  });

  await test('입력창이 추가 후 비워지는지 확인', async () => {
    await resetPage();
    await page.fill('#item-input', '포도');
    await page.press('#item-input', 'Enter');
    const value = await page.inputValue('#item-input');
    assert(value === '', `입력창이 비워지지 않음: "${value}"`);
  });

  await test('빈 문자열은 추가되지 않음', async () => {
    await resetPage();
    await page.fill('#item-input', '   ');
    await page.press('#item-input', 'Enter');
    const items = await page.$$('.item-name');
    assert(items.length === 0, `빈 값이 추가됨 (${items.length}개)`);
  });

  await test('여러 아이템 추가 후 개수 확인', async () => {
    await resetPage();
    for (const name of ['우유', '계란', '빵']) {
      await page.fill('#item-input', name);
      await page.press('#item-input', 'Enter');
    }
    const items = await page.$$('.item-name');
    assert(items.length === 3, `예상: 3개, 실제: ${items.length}개`);
  });

  console.log('\n☑️  체크 기능');

  await test('체크박스 클릭 시 취소선 표시', async () => {
    await resetPage();
    await page.fill('#item-input', '치즈');
    await page.press('#item-input', 'Enter');
    await page.click('li input[type="checkbox"]');
    const isChecked = await page.$eval('li', el => el.classList.contains('checked'));
    assert(isChecked, 'checked 클래스가 없음');
  });

  await test('체크 후 다시 클릭하면 체크 해제', async () => {
    await resetPage();
    await page.fill('#item-input', '버터');
    await page.press('#item-input', 'Enter');
    await page.click('li input[type="checkbox"]');
    await page.click('li input[type="checkbox"]');
    const isChecked = await page.$eval('li', el => el.classList.contains('checked'));
    assert(!isChecked, '체크가 해제되지 않음');
  });

  await test('체크 시 요약 카운트 갱신', async () => {
    await resetPage();
    for (const name of ['A', 'B', 'C']) {
      await page.fill('#item-input', name);
      await page.press('#item-input', 'Enter');
    }
    await page.click('li:first-child input[type="checkbox"]');
    const summary = await page.textContent('#summary');
    assert(summary.includes('완료') && summary.includes('1'), `요약 오류: "${summary}"`);
  });

  await test('체크된 항목 있을 때 "완료된 항목 삭제" 버튼 표시', async () => {
    await resetPage();
    await page.fill('#item-input', '오렌지');
    await page.press('#item-input', 'Enter');
    await page.click('li input[type="checkbox"]');
    const visible = await page.isVisible('#clear-btn');
    assert(visible, '"완료된 항목 삭제" 버튼이 보이지 않음');
  });

  console.log('\n🗑️  아이템 삭제');

  await test('✕ 버튼으로 아이템 삭제', async () => {
    await resetPage();
    await page.fill('#item-input', '딸기');
    await page.press('#item-input', 'Enter');
    await page.click('.delete-btn');
    const items = await page.$$('.item-name');
    assert(items.length === 0, `삭제 후에도 ${items.length}개 남음`);
  });

  await test('삭제 후 "아직 아이템이 없습니다" 표시', async () => {
    await resetPage();
    await page.fill('#item-input', '키위');
    await page.press('#item-input', 'Enter');
    await page.click('.delete-btn');
    const emptyText = await page.textContent('.empty');
    assert(emptyText.includes('아직 아이템이 없습니다'), `빈 상태 메시지 없음`);
  });

  await test('여러 아이템 중 특정 항목만 삭제', async () => {
    await resetPage();
    for (const name of ['망고', '파인애플', '수박']) {
      await page.fill('#item-input', name);
      await page.press('#item-input', 'Enter');
    }
    await page.click('li:last-child .delete-btn');
    const items = await page.$$('.item-name');
    assert(items.length === 2, `예상: 2개, 실제: ${items.length}개`);
  });

  await test('"완료된 항목 삭제" 버튼으로 일괄 삭제', async () => {
    await resetPage();
    for (const name of ['토마토', '당근', '양파']) {
      await page.fill('#item-input', name);
      await page.press('#item-input', 'Enter');
    }
    await page.click('li:first-child input[type="checkbox"]');
    await page.click('li:last-child input[type="checkbox"]');
    await page.click('#clear-btn');
    const items = await page.$$('.item-name');
    assert(items.length === 1, `예상: 1개, 실제: ${items.length}개`);
  });

  console.log('\n💾 데이터 유지');

  await test('페이지 새로고침 후 아이템 유지', async () => {
    await resetPage();
    await page.fill('#item-input', '초콜릿');
    await page.press('#item-input', 'Enter');
    await page.reload();
    const text = await page.textContent('.item-name');
    assert(text === '초콜릿', `새로고침 후 데이터 소실: "${text}"`);
  });

  await test('체크 상태가 새로고침 후에도 유지', async () => {
    await resetPage();
    await page.fill('#item-input', '쿠키');
    await page.press('#item-input', 'Enter');
    await page.click('li input[type="checkbox"]');
    await page.reload();
    const isChecked = await page.$eval('li', el => el.classList.contains('checked'));
    assert(isChecked, '새로고침 후 체크 상태 소실');
  });

  console.log('\n🌙 다크 모드');

  await test('테마 버튼 클릭 시 dark 클래스 추가', async () => {
    await resetPage();
    await page.click('#theme-btn');
    const isDark = await page.$eval('body', el => el.classList.contains('dark'));
    assert(isDark, 'dark 클래스가 추가되지 않음');
  });

  await test('다시 클릭하면 dark 클래스 제거', async () => {
    await resetPage();
    await page.click('#theme-btn');
    await page.click('#theme-btn');
    const isDark = await page.$eval('body', el => el.classList.contains('dark'));
    assert(!isDark, 'dark 클래스가 제거되지 않음');
  });

  await test('다크 모드 설정이 새로고침 후에도 유지', async () => {
    await resetPage();
    await page.click('#theme-btn');
    await page.reload();
    const isDark = await page.$eval('body', el => el.classList.contains('dark'));
    assert(isDark, '새로고침 후 다크 모드 소실');
  });

  const total = passed + failed;
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`결과: ${passed}/${total} 통과 ${failed > 0 ? `(${failed}개 실패)` : ''}`);
  if (failed === 0) console.log('모든 테스트를 통과했습니다! 🎉');
  console.log('─'.repeat(40));

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();