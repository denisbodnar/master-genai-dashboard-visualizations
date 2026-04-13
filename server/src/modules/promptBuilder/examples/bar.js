/**
 * @fileoverview Few-shot приклад для типу 'bar' (стовпчикова діаграма).
 * D3.js v7, динамічні розміри, tooltip, осі, підписи.
 */

export const schema = {
  total_rows: 6,
  columns: [
    { name: 'category', type: 'Categorical', cardinality: 6, mode: 'Electronics', null_rate: 0 },
    { name: 'sales', type: 'Numeric', min: 500, max: 8200, mean: 3800, null_rate: 0 },
  ],
  sample: [
    { category: 'Electronics', sales: 8200 },
    { category: 'Clothing', sales: 4500 },
    { category: 'Food', sales: 2100 },
  ],
};

export const code = `
function renderChart(data, containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const bounds = container.node().getBoundingClientRect();
  const margin = { top: 20, right: 30, bottom: 60, left: 70 };
  const width = (bounds.width || 600) - margin.left - margin.right;
  const height = (bounds.height || 400) - margin.top - margin.bottom;

  const svg = container
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

  const parsed = data.map(d => ({ category: String(d.category), sales: +d.sales }));

  const x = d3.scaleBand()
    .domain(parsed.map(d => d.category))
    .range([0, width])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(parsed, d => d.sales) * 1.1])
    .range([height, 0]);

  svg.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-20)')
    .attr('text-anchor', 'end');

  svg.append('g').call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', width / 2).attr('y', height + 50)
    .attr('text-anchor', 'middle').text('Category');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -55)
    .attr('text-anchor', 'middle').text('Sales');

  const tooltip = d3.select('body').append('div')
    .style('position', 'absolute')
    .style('background', 'rgba(0,0,0,0.75)')
    .style('color', '#fff')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  svg.selectAll('rect')
    .data(parsed)
    .join('rect')
    .attr('x', d => x(d.category))
    .attr('y', d => y(d.sales))
    .attr('width', x.bandwidth())
    .attr('height', d => height - y(d.sales))
    .attr('fill', '#4f7cff')
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(\`<strong>\${d.category}</strong><br>Sales: \${d.sales.toLocaleString()}\`);
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));
}
`.trim();

export default { schema, code };
