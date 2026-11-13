import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import {
  createUniComponentFromWebComponent,
  DataViewUIBase,
  DataViewUILogicBase,
  type DataViewUILogicBaseConstructor,
  defineUniComponent,
  renderUniLit,
  viewType,
} from '@blocksuite/data-view';
import {
  TableSingleView,
  type TableViewData,
  tableViewModel,
} from '@blocksuite/data-view/view-presets';
import { css, html, nothing, svg } from 'lit';
import { state } from 'lit/decorators.js';

import {
  EditorHostKey,
  WorkspaceDatabaseSourceKey,
} from '../context/host-context.js';
import { workspaceViewIcon, workspaceViews } from './workspace-view-types.js';
import { worldLand } from './world-land.js';

type Source = { pageId: string; blockId: string };
type WorkspaceViewData = Omit<TableViewData, 'mode'> & {
  mode: string;
  category?: string;
  measure?: string;
  source?: Source;
};

class WorkspaceView extends TableSingleView {
  get settings(): WorkspaceViewData | undefined {
    return this.data$.value as WorkspaceViewData | undefined;
  }

  configure(settings: Partial<WorkspaceViewData>) {
    this.dataUpdate(() => settings as Partial<TableViewData>);
  }
}

class WorkspaceViewLogic extends DataViewUILogicBase<WorkspaceView> {
  clearSelection = () => {};
  addRow = () => undefined;
  focusFirstCell = () => {};
  showIndicator = () => false;
  hideIndicator = () => {};
  moveTo = () => {};
  renderer = createUniComponentFromWebComponent(WorkspaceViewElement);
}

const colors = ['#5287df', '#67b79c', '#e8a45a', '#aa83dd', '#db7791'];
const formatNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export class WorkspaceViewElement extends DataViewUIBase<WorkspaceViewLogic> {
  static override styles = css`
    affine-database-workspace-view {
      display: block;
    }
    .workspace-view-body {
      padding: 12px 8px;
      color: var(--affine-text-primary-color);
    }
    .workspace-view-settings {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      margin-bottom: 12px;
    }
    .workspace-view-body label {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .workspace-view-body :is(input, select, button) {
      font: inherit;
      color: inherit;
      background: var(--affine-background-primary-color);
      border: 1px solid var(--affine-border-color);
      border-radius: 5px;
      padding: 5px 8px;
    }
    .workspace-view-body svg {
      display: block;
      width: 100%;
      max-height: 320px;
    }
    .workspace-view-body svg text {
      fill: currentColor;
      font: 12px sans-serif;
    }
    .workspace-view-body form {
      display: grid;
      gap: 12px;
      justify-items: start;
    }
    .workspace-view-number {
      font-size: 44px;
      font-weight: 600;
      margin: 16px 0;
    }
    .workspace-view-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      padding: 0;
      list-style: none;
    }
    .workspace-view-table {
      max-height: 360px;
      overflow: auto;
    }
    .workspace-view-table table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .workspace-view-table :is(th, td) {
      padding: 6px 10px;
      border: 1px solid var(--affine-border-color);
    }
  `;

  @state()
  private accessor pageId = '';

  @state()
  private accessor submitted = false;

  @state()
  private accessor mapZoom = 1;

  private get view() {
    return this.logic.view;
  }

  private databases(pageId: string) {
    const host = this.view.serviceGet(EditorHostKey);
    const store =
      host?.store.id === pageId
        ? host.store
        : host?.store.workspace.getDoc(pageId)?.getStore({ readonly: true });
    if (!store) return [];
    if (!store.loaded) store.load();
    return store.getModelsByFlavour('affine:database') as DatabaseBlockModel[];
  }

  private linkedView(source: Source) {
    const model = this.databases(source.pageId).find(
      model => model.id === source.blockId && model.id !== this.ownerId
    );
    if (!model) return undefined;
    return this.view.serviceGet(WorkspaceDatabaseSourceKey)?.getView(model);
  }

  private get ownerId() {
    return this.view.serviceGet(WorkspaceDatabaseSourceKey)?.ownerId;
  }

  private sourcePicker() {
    const source = this.view.settings?.source;
    const pageId = this.pageId || source?.pageId || '';
    const pages =
      this.view.serviceGet(EditorHostKey)?.store.workspace.meta.docMetas ?? [];
    return html`
      <label
        >Source page
        <select
          .value=${pageId}
          @change=${(event: Event) => {
            this.pageId = (event.target as HTMLSelectElement).value;
            if (!this.pageId)
              this.view.configure({
                source: undefined,
                category: undefined,
                measure: undefined,
              });
          }}
        >
          <option value="">
            ${this.view.type === 'linked-source' ? 'Select a page' : 'This database'}
          </option>
          ${pages.map(page => html`<option value=${page.id} ?selected=${page.id === pageId}>${page.title || 'Untitled'}</option>`)}
        </select>
      </label>
      ${
        pageId
          ? html` <label
              >Data source
              <select
                @change=${(event: Event) => {
                  const blockId = (event.target as HTMLSelectElement).value;
                  this.view.configure({
                    source: blockId ? { pageId, blockId } : undefined,
                    category: undefined,
                    measure: undefined,
                  });
                }}
              >
                <option value="">Select a database</option>
                ${this.databases(pageId)
                  .filter(
                    model =>
                      model.id !== this.ownerId &&
                      model.props.views.some(
                        view => view.mode !== 'linked-source'
                      )
                  )
                  .map(
                    model => html`
                      <option
                        value=${model.id}
                        ?selected=${source?.pageId === pageId && source.blockId === model.id}
                      >
                        ${model.props.title.toString() || 'Untitled database'}
                      </option>
                    `
                  )}
              </select>
            </label>`
          : nothing
      }
    `;
  }

  private table(
    data: TableSingleView | ReturnType<WorkspaceViewElement['linkedView']>
  ) {
    if (!data)
      return html`<p>Select an existing database to show its rows here.</p>`;
    const properties = data.propertiesRaw$.value.filter(
      property =>
        !['type', 'created-by', 'created-time'].includes(property.type$.value)
    );
    return html`<div class="workspace-view-table">
      <table>
        <thead>
          <tr>
            ${properties.map(property => html`<th scope="col">${property.name$.value}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${data.rowsRaw$.value.map(
            ({ rowId }) =>
              html`<tr>
                ${properties.map(
                  property =>
                    html`<td>
                      ${data.cellGetOrCreate(rowId, property.id).stringValue$.value}
                    </td>`
                )}
              </tr>`
          )}
        </tbody>
      </table>
    </div>`;
  }

  private form() {
    const fields = this.view.propertiesRaw$.value.filter(property =>
      ['title', 'rich-text', 'number', 'checkbox'].includes(
        property.type$.value
      )
    );
    if (this.view.readonly$.value) return html`<p>This form is read-only.</p>`;
    return html`<form
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        if (this.view.readonly$.value) return;
        const values = new FormData(form);
        const rowId = this.view.rowAdd('end');
        for (const field of fields) {
          const type = field.type$.value;
          const value = values.get(field.id);
          const cell = this.view.cellGetOrCreate(rowId, field.id);
          if (type === 'checkbox') cell.jsonValueSet(value !== null);
          else if (typeof value === 'string' && value !== '') {
            if (type === 'rich-text') {
              const dataSource = this.view.manager.dataSource;
              const parsed = field.meta$.value?.config.rawValue.fromString?.({
                value,
                data: field.data$.value,
                dataSource,
              });
              if (parsed) cell.valueSet(parsed.value);
            } else cell.jsonValueSet(type === 'number' ? Number(value) : value);
          }
        }
        form.reset();
        this.submitted = true;
      }}
    >
      ${fields.map(field => {
        const type = field.type$.value;
        return html`<label
          >${field.name$.value}
          <input
            name=${field.id}
            type=${type === 'number' ? 'number' : type === 'checkbox' ? 'checkbox' : 'text'}
            step="any"
            ?required=${type === 'title'}
          />
        </label>`;
      })}
      <button type="submit">Submit</button>
      ${this.submitted ? html`<span role="status">Response saved</span>` : nothing}
    </form>`;
  }

  private map(
    data: NonNullable<ReturnType<WorkspaceViewElement['linkedView']>>
  ) {
    const props = data.propertiesRaw$.value;
    const latitude = props.find(property =>
      /^latitude$/i.test(property.name$.value)
    );
    const longitude = props.find(property =>
      /^longitude$/i.test(property.name$.value)
    );
    const title = data.mainProperties$.value.titleColumn;
    const points =
      latitude && longitude
        ? data.rowsRaw$.value.flatMap(({ rowId }) => {
            const lat = data.cellGetOrCreate(rowId, latitude.id).jsonValue$
              .value;
            const lon = data.cellGetOrCreate(rowId, longitude.id).jsonValue$
              .value;
            if (
              typeof lat !== 'number' ||
              !Number.isFinite(lat) ||
              Math.abs(lat) > 90 ||
              typeof lon !== 'number' ||
              !Number.isFinite(lon) ||
              Math.abs(lon) > 180
            )
              return [];
            return [
              {
                x: 360 + lon * 2,
                y: 180 - lat * 2,
                label: title
                  ? data.cellGetOrCreate(rowId, title).stringValue$.value
                  : '',
              },
            ];
          })
        : [];
    const width = 720 / this.mapZoom;
    const height = 360 / this.mapZoom;
    return html`
      <div class="workspace-view-settings">
        <button
          aria-label="Zoom out"
          @click=${() => {
            this.mapZoom = Math.max(1, this.mapZoom / 2);
          }}
        >
          −
        </button>
        <button
          aria-label="Zoom in"
          @click=${() => {
            this.mapZoom = Math.min(4, this.mapZoom * 2);
          }}
        >
          +
        </button>
      </div>
      <svg
        viewBox="${(720 - width) / 2} ${(360 - height) / 2} ${width} ${height}"
        role="img"
        aria-label="Latitude and longitude map"
      >
        <rect
          width="720"
          height="360"
          fill="var(--affine-background-secondary-color)"
        />
        <path
          d=${worldLand}
          fill="currentColor"
          opacity=".18"
          fill-rule="evenodd"
        />
        ${Array.from({ length: 13 }, (_, index) => svg`<path d="M${index * 60} 0v360" stroke="currentColor" opacity=".2" />`)}
        ${Array.from({ length: 7 }, (_, index) => svg`<path d="M0 ${index * 60}h720" stroke="currentColor" opacity=".2" />`)}
        ${points.map(point => svg`<circle cx=${point.x} cy=${point.y} r="6" fill=${colors[0]}><title>${point.label || 'Database row'}</title></circle>`)}
      </svg>
      ${points.length ? nothing : html`<p>Add coordinates to the Latitude and Longitude number properties in Table View.</p>`}
    `;
  }

  private chart(
    data: NonNullable<ReturnType<WorkspaceViewElement['linkedView']>>
  ) {
    const { type, settings } = this.view;
    const props = data.propertiesRaw$.value.filter(
      property =>
        !['type', 'created-by', 'created-time'].includes(property.type$.value)
    );
    const numbers = props.filter(property => property.type$.value === 'number');
    const category =
      props.find(property => property.id === settings?.category)?.id ??
      data.mainProperties$.value.titleColumn;
    const measure = numbers.find(
      property => property.id === settings?.measure
    )?.id;
    const groups = new Map<string, number>();
    let total = 0;
    for (const { rowId } of data.rowsRaw$.value) {
      const label =
        (category
          ? data.cellGetOrCreate(rowId, category).stringValue$.value
          : '') || 'Untitled';
      const value = measure
        ? data.cellGetOrCreate(rowId, measure).jsonValue$.value
        : 1;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      total += value;
      groups.set(label, (groups.get(label) ?? 0) + value);
    }
    return html`
      ${
        this.view.readonly$.value
          ? nothing
          : html`<div class="workspace-view-settings">
              ${
                type === 'number'
                  ? nothing
                  : html`<label
                      >Group by
                      <select
                        @change=${(event: Event) => this.view.configure({ category: (event.target as HTMLSelectElement).value })}
                      >
                        ${props.map(property => html`<option value=${property.id} ?selected=${property.id === category}>${property.name$.value}</option>`)}
                      </select>
                    </label>`
              }
              <label
                >Measure
                <select
                  @change=${(event: Event) => this.view.configure({ measure: (event.target as HTMLSelectElement).value })}
                >
                  <option value="" ?selected=${!measure}>Count</option>
                  ${numbers.map(property => html`<option value=${property.id} ?selected=${property.id === measure}>Sum of ${property.name$.value}</option>`)}
                </select>
              </label>
            </div>`
      }
      ${
        type === 'number'
          ? html`<div class="workspace-view-number">
              ${formatNumber.format(total)}
            </div>`
          : groups.size
            ? this.plot([...groups])
            : html`<p>Add rows in Table View to populate this chart.</p>`
      }
    `;
  }

  private plot(groups: [string, number][]) {
    const type = this.view.type;
    if (type === 'donut') {
      const total = groups.reduce((sum, [, value]) => sum + value, 0);
      if (total <= 0 || groups.some(([, value]) => value < 0)) {
        return html`<p>
          Donut charts require non-negative values and a positive total.
        </p>`;
      }
      let offset = 0;
      return html`<svg
          viewBox="0 0 240 200"
          role="img"
          aria-label="Donut chart"
        >
          ${groups.map(([label, value], index) => {
            const length = (value / total) * 100;
            const start = offset;
            offset += length;
            return svg`<circle cx="120" cy="100" r="72" pathLength="100" fill="none" stroke-width="28"
            stroke=${colors[index % colors.length]} stroke-dasharray="${length} 100"
            stroke-dashoffset=${-start} transform="rotate(-90 120 100)"><title>${label}: ${formatNumber.format(value)}</title></circle>`;
          })}</svg
        >${this.legend(groups, true)}`;
    }
    const horizontal = type === 'horizontal-bar';
    const values = groups.map(([, value]) => value);
    const min = Math.min(0, ...values);
    const span = Math.max(0, ...values) - min || 1;
    const scale = (value: number) => (value - min) / span;
    const zero = scale(0);
    const step = (horizontal ? 190 : 560) / groups.length;
    const points = groups.map(([label, value], index) => {
      const position = 20 + (index + 0.5) * step;
      return {
        label,
        value,
        x: horizontal ? 20 + scale(value) * 560 : position,
        y: horizontal ? position : 210 - scale(value) * 190,
      };
    });
    return html`<svg
        viewBox="0 0 600 230"
        role="img"
        aria-label=${this.view.name$.value}
      >
        ${
          horizontal
            ? svg`<path d="M${20 + zero * 560} 20v190" stroke="currentColor" opacity=".35" />`
            : svg`<path d="M20 ${210 - zero * 190}h560" stroke="currentColor" opacity=".35" />`
        }
        ${
          type === 'line'
            ? svg`<polyline fill="none" stroke=${colors[0]} stroke-width="2"
        points=${points.map(({ x, y }) => `${x},${y}`).join(' ')} />`
            : nothing
        }
        ${points.map(({ label, value, x, y }) => {
          const tooltip = svg`<title>${label}: ${formatNumber.format(value)}</title>`;
          if (type === 'line')
            return svg`<circle cx=${x} cy=${y} r="4" fill=${colors[0]}>${tooltip}</circle>`;
          const baseline = horizontal ? 20 + zero * 560 : 210 - zero * 190;
          return horizontal
            ? svg`<rect x=${Math.min(baseline, x)} y=${y - step * 0.3} width=${Math.abs(x - baseline)} height=${step * 0.6} fill=${colors[0]}>${tooltip}</rect>`
            : svg`<rect x=${x - step * 0.3} y=${Math.min(baseline, y)} width=${step * 0.6} height=${Math.abs(y - baseline)} fill=${colors[0]}>${tooltip}</rect>`;
        })}</svg
      >${this.legend(groups, false)}`;
  }

  private legend(groups: [string, number][], colored: boolean) {
    return html`<ul class="workspace-view-legend">
      ${groups.map(
        ([label, value], index) =>
          html`<li>
            <span
              aria-hidden="true"
              style="color:${colors[colored ? index % colors.length : 0]}"
              >●</span
            >
            ${label} · ${formatNumber.format(value)}
          </li>`
      )}
    </ul>`;
  }

  protected override render() {
    const { headerWidget } = this.logic;
    const { type, settings } = this.view;
    const linked = settings?.source
      ? this.linkedView(settings.source)
      : undefined;
    const data = settings?.source ? linked : this.view;
    return html` ${headerWidget ? renderUniLit(headerWidget, { dataViewLogic: this.logic }) : nothing}
      <div class="workspace-view-body" contenteditable="false">
        ${
          !this.view.readonly$.value && type !== 'form'
            ? html`<div class="workspace-view-settings">
                ${this.sourcePicker()}
              </div>`
            : nothing
        }
        ${
          type === 'linked-source'
            ? this.table(linked)
            : type === 'form'
              ? this.form()
              : !data
                ? html`<p>The selected database is unavailable.</p>`
                : type === 'map'
                  ? this.map(data)
                  : this.chart(data)
        }
      </div>`;
  }
}

export const workspaceViewMetas = workspaceViews.map(([type, name, icon]) =>
  viewType(type)
    .createModel<WorkspaceViewData>({
      defaultName: name,
      dataViewManager: WorkspaceView,
      defaultData: manager => tableViewModel.model.defaultData(manager),
    })
    .createMeta({
      icon: defineUniComponent(() => html`${workspaceViewIcon(icon)}`),
      pcLogic: () =>
        WorkspaceViewLogic as unknown as DataViewUILogicBaseConstructor,
    })
);
