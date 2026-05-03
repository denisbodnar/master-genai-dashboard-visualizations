/**
 * @fileoverview Few-shot приклад для типу 'grouped-bar' (згрупована стовпчикова діаграма).
 * D3.js v7, scaleBand вкладені, легенда, tooltip.
 */

export const schema = {
  total_rows: 12,
  columns: [
    { name: 'quarter', type: 'Categorical', cardinality: 4, mode: 'Q1', null_rate: 0 },
    { name: 'department', type: 'Categorical', cardinality: 3, mode: 'Sales', null_rate: 0 },
    { name: 'budget', type: 'Numeric', min: 10000, max: 85000, mean: 42000, null_rate: 0 },
  ],
  sample: [
    { quarter: 'Q1', department: 'Sales', budget: 45000 },
    { quarter: 'Q1', department: 'HR', budget: 22000 },
    { quarter: 'Q2', department: 'Sales', budget: 58000 },
  ],
};

export const code = `
function renderChart(data, containerSelector) {
  const container = d3.select(containerSelector);
  container.selectAll('*').remove();

  const bounds = container.node().getBoundingClientRect();
  const margin = { top: 20, right: 140, bottom: 60, left: 70 };
  const width = (bounds.width || 650) - margin.left - margin.right;
  const height = (bounds.height || 400) - margin.top - margin.bottom;

  const svg = container
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', \`translate(\${margin.left},\${margin.top})\`);

  const parsed = data.map(d => ({
    quarter: String(d.quarter),
    department: String(d.department),
    budget: +d.budget,
  }));

  const quarters = [...new Set(parsed.map(d => d.quarter))];
  const departments = [...new Set(parsed.map(d => d.department))];

  const x0 = d3.scaleBand().domain(quarters).range([0, width]).padding(0.2);
  const x1 = d3.scaleBand().domain(departments).range([0, x0.bandwidth()]).padding(0.05);
  const y = d3.scaleLinear()
    .domain([0, d3.max(parsed, d => d.budget) * 1.1])
    .range([height, 0]);

  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(departments);

  svg.append('g')
    .attr('transform', \`translate(0,\${height})\`)
    .call(d3.axisBottom(x0));

  svg.append('g').call(d3.axisLeft(y));

  svg.append('text')
    .attr('x', width / 2).attr('y', height + 50)
    .attr('text-anchor', 'middle').text('Quarter');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -55)
    .attr('text-anchor', 'middle').text('Budget');

  const tooltip = d3.select('body').append('div')
    .style('position', 'absolute')
    .style('background', 'rgba(0,0,0,0.75)')
    .style('color', '#fff')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  const quarterGroups = svg.selectAll('g.quarter')
    .data(quarters)
    .join('g')
    .attr('class', 'quarter')
    .attr('transform', d => \`translate(\${x0(d)}, 0)\`);

  quarterGroups.selectAll('rect')
    .data(q => departments.map(dep => {
      const row = parsed.find(r => r.quarter === q && r.department === dep);
      return { department: dep, quarter: q, budget: row ? row.budget : 0 };
    }))
    .join('rect')
    .attr('x', d => x1(d.department))
    .attr('y', d => y(d.budget))
    .attr('width', x1.bandwidth())
    .attr('height', d => height - y(d.budget))
    .attr('fill', d => color(d.department))
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(\`<strong>\${d.department}</strong> / \${d.quarter}<br>Budget: \${d.budget.toLocaleString()}\`);
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));

  // Legend
  const legend = svg.append('g').attr('transform', \`translate(\${width + 10}, 0)\`);
  departments.forEach((dep, i) => {
    const g = legend.append('g').attr('transform', \`translate(0, \${i * 22})\`);
    g.append('rect').attr('width', 14).attr('height', 14).attr('fill', color(dep));
    g.append('text').attr('x', 18).attr('y', 12).style('font-size', '12px').text(dep);
  });
}
`.trim();

export default { schema, code };
