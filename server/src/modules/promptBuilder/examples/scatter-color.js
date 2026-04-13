/**
 * @fileoverview Few-shot приклад для типу 'scatter-color' (scatter з кольоровим кодуванням).
 * D3.js v7, scaleOrdinal для кольору категорій, легенда, tooltip.
 */

export const schema = {
  total_rows: 80,
  columns: [
    { name: 'age', type: 'Numeric', min: 18, max: 65, mean: 38, null_rate: 0 },
    { name: 'income', type: 'Numeric', min: 20000, max: 150000, mean: 72000, null_rate: 0 },
    { name: 'education', type: 'Categorical', cardinality: 3, mode: 'Bachelor', null_rate: 0 },
  ],
  sample: [
    { age: 28, income: 45000, education: 'Bachelor' },
    { age: 45, income: 110000, education: 'Master' },
    { age: 35, income: 72000, education: 'PhD' },
  ],
};

export const code = `
function renderChart(data, containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const bounds = container.node().getBoundingClientRect();
  const margin = { top: 20, right: 140, bottom: 50, left: 80 };
  const width = (bounds.width || 650) - margin.left - margin.right;
  const height = (bounds.height || 400) - margin.top - margin.bottom;

  const svg = container
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

  const parsed = data.map(d => ({ x: +d.age, y: +d.income, cat: String(d.education) }));
  const categories = [...new Set(parsed.map(d => d.cat))];

  const x = d3.scaleLinear().domain(d3.extent(parsed, d => d.x)).nice().range([0, width]);
  const y = d3.scaleLinear().domain(d3.extent(parsed, d => d.y)).nice().range([height, 0]);
  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(categories);

  svg.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(x));

  svg.append('g').call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', width / 2).attr('y', height + 40)
    .attr('text-anchor', 'middle').text('Age');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -65)
    .attr('text-anchor', 'middle').text('Income');

  const tooltip = d3.select('body').append('div')
    .style('position', 'absolute')
    .style('background', 'rgba(0,0,0,0.75)')
    .style('color', '#fff')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  svg.selectAll('circle')
    .data(parsed)
    .join('circle')
    .attr('cx', d => x(d.x))
    .attr('cy', d => y(d.y))
    .attr('r', 6)
    .attr('fill', d => color(d.cat))
    .attr('opacity', 0.75)
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(\`<strong>\${d.cat}</strong><br>Age: \${d.x}<br>Income: $\${d.y.toLocaleString()}\`);
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));

  // Legend
  const legend = svg.append('g').attr('transform', \`translate(\${width + 10}, 0)\`);
  categories.forEach((cat, i) => {
    const g = legend.append('g').attr('transform', \`translate(0, \${i * 22})\`);
    g.append('circle').attr('r', 6).attr('cx', 7).attr('cy', 7).attr('fill', color(cat));
    g.append('text').attr('x', 18).attr('y', 12).style('font-size', '12px').text(cat);
  });
}
`.trim();

export default { schema, code };
