/**
 * @param {object} schema - Schema JSON from inferSchema.
 * @returns {string}
 */
export function buildSchemaBlock(schema) {
  const { sample, ...schemaWithoutSample } = schema;

  const schemaJson = JSON.stringify(schemaWithoutSample, null, 2);
  const sampleJson = JSON.stringify(sample ?? [], null, 2);

  return [
    '[Dataset]',
    `Schema: ${schemaJson}`,
    `Sample: ${sampleJson}`,
  ].join('\n');
}
