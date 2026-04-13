/**
 * @fileoverview Блок B_schema — контекст даних (Schema + Sample).
 * Підрозділ 3.3 записки. Серіалізує Schema JSON у форматі Лістингу 3.1.
 *
 * Розмір блоку: ~200–400 токенів незалежно від обсягу вхідного CSV —
 * ключова передумова масштабованості (підрозділ 2.3).
 */

/**
 * Формує блок B_schema системного промпту.
 * Підставляє SchemaJSON та SampleJSON із артефакту алгоритму 3.1.
 *
 * @param {object} schema - Schema JSON (результат inferSchema).
 * @param {object[]} [schema.columns] - Стовпці з типами та статистикою.
 * @param {object[]} [schema.sample]  - Вибіркові рядки (3 записи).
 * @returns {string} Текст блоку B_schema.
 */
export function buildSchemaBlock(schema) {
  // Відокремлюємо sample від решти схеми для чіткого відображення
  const { sample, ...schemaWithoutSample } = schema;

  const schemaJson = JSON.stringify(schemaWithoutSample, null, 2);
  const sampleJson = JSON.stringify(sample ?? [], null, 2);

  return [
    '[Dataset]',
    `Schema: ${schemaJson}`,
    `Sample: ${sampleJson}`,
  ].join('\n');
}
