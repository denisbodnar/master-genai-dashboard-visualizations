/**
 * @fileoverview Few-shot example for chart type 'multiline' (multi-line chart).
 * D3.js v7, dynamic sizing, colour legend, tooltip.
 */

export const schema = {
  total_rows: 12,
  columns: [
    { name: 'date', type: 'Temporal', range: ['2023-01-01', '2023-12-01'], step: 'month', null_rate: 0 },
    { name: 'product_a', type: 'Numeric', min: 5000, max: 45000, mean: 22000, null_rate: 0 },
    { name: 'product_b', type: 'Numeric', min: 3000, max: 38000, mean: 18000, null_rate: 0 },
  ],
  sample: [
    { date: '2023-01-01', product_a: 12000, product_b: 8000 },
    { date: '2023-06-01', product_a: 32000, product_b: 25000 },
    { date: '2023-12-01', product_a: 41000, product_b: 35000 },
  ],
};

export const code = `
function renderChart(data, containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const bounds = container.node().getBoundingClientRect();
  const margin = { top: 20, right: 120, bottom: 50, left: 70 };
  const width = (bounds.width || 650) - margin.left - margin.right;
  const height = (bounds.height || 400) - margin.top - margin.bottom;

  const svg = container
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

  const parseDate = d3.timeParse('%Y-%m-%d');
  const numericKeys = Object.keys(data[0]).filter(k => k !== 'date');
  const parsed = data.map(d => ({
    date: parseDate(d.date),
    ...Object.fromEntries(numericKeys.map(k => [k, +d[k]])),
  }));

  const x = d3.scaleTime()
    .domain(d3.extent(parsed, d => d.date))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(parsed, d => d3.max(numericKeys, k => d[k])) * 1.1])
    .range([height, 0]);

  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(numericKeys);

  svg.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%b %Y')));

  svg.append('g').call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', width / 2).attr('y', height + 40)
    .attr('text-anchor', 'middle').text('Date');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -55)
    .attr('text-anchor', 'middle').text('Value');

  const tooltip = d3.select('body').append('div')
    .style('position', 'absolute')
    .style('background', 'rgba(0,0,0,0.75)')
    .style('color', '#fff')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  numericKeys.forEach(key => {
    const lineGen = d3.line()
      .x(d => x(d.date))
      .y(d => y(d[key]))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(parsed)
      .attr('fill', 'none')
      .attr('stroke', color(key))
      .attr('stroke-width', 2.5)
      .attr('d', lineGen);

    svg.selectAll(\`circle.\${key}\`)
      .data(parsed)
      .join('circle')
      .attr('class', key)
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d[key]))
      .attr('r', 4)
      .attr('fill', color(key))
      .on('mouseover', (event, d) => {
        tooltip.style('opacity', 1)
          .html(\`\${key}<br>\${d3.timeFormat('%b %Y')(d.date)}: \${d[key].toLocaleString()}\`);
      })
      .on('mousemove', event => {
        tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', 0));
  });

  // Legend
  const legend = svg.append('g').attr('transform', \`translate(\${width + 10}, 0)\`);
  numericKeys.forEach((key, i) => {
    const g = legend.append('g').attr('transform', \`translate(0, \${i * 22})\`);
    g.append('line').attr('x2', 18).attr('stroke', color(key)).attr('stroke-width', 2.5);
    g.append('text').attr('x', 22).attr('y', 5).style('font-size', '12px').text(key);
  });
}
`.trim();

export default { schema, code };
