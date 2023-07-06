import { css, html, LitElement, nothing, TemplateResult } from 'lit';
import { msg } from '@lit/localize';
import { property, query, state } from 'lit/decorators.js';

import '@material/mwc-button';
import '@material/mwc-formfield';
import '@material/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-radio-list-item';
import '@material/mwc-icon-button';

import './foundation/components/oscd-filter-button.js';
import './foundation/components/oscd-filtered-list.js';

import { Insert, newEditEvent, Remove } from '@openscd/open-scd-core';
import type { Dialog } from '@material/mwc-dialog';
import type { SelectedItemsChangedEvent } from './foundation/components/oscd-filter-button.js';

import {
  compareNames,
  getDescriptionAttribute,
  getNameAttribute,
} from './foundation/foundation.js';
import type { OscdFilteredList } from './foundation/components/oscd-filtered-list.js';
import { identity } from './foundation/identities/identity.js';
import { selector } from './foundation/identities/selector.js';

interface storedInput {
  id: string;
  input: Element;
}

export default class ReplaceIEDs extends LitElement {
  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  @property({ attribute: false })
  docName!: string;

  @state()
  private get iedList(): Element[] {
    return this.doc
      ? Array.from(this.doc.querySelectorAll(':root > IED')).sort((a, b) =>
          compareNames(a, b)
        )
      : [];
  }

  @state()
  selectedIEDs: string[] = [];

  @state()
  private get selectedIed(): Element | undefined {
    // When there is no IED selected, or the selected IED has no parent (IED has been removed)
    // select the first IED from the List.
    if (this.selectedIEDs.length >= 1) {
      return this.iedList.find(element => {
        const iedName = getNameAttribute(element);
        return this.selectedIEDs[0] === iedName;
      });
    }
    return undefined;
  }

  @query('#dialog') dialogUI?: Dialog;

  @query('#replaceIeds') replaceIedsUI?: OscdFilteredList;

  async run() {
    this.dialogUI?.show();
  }

  private replaceIeds(): void {
    const selected = Array.isArray(this.replaceIedsUI?.selected)
      ? this.replaceIedsUI?.selected
      : [this.replaceIedsUI?.selected];

    if (!this.replaceIedsUI?.selected || !selected || !this.selectedIed) return;

    const inputsSections = new Map<string, [storedInput]>();
    const gseControlSections = new Map<string, [storedInput]>();

    selected.forEach(iedListItem => {
      const { id } = iedListItem!.dataset;

      const currentIed = this.doc.querySelector(selector('IED', id!))!;

      const currentIedName = currentIed.getAttribute('name')!;

      Array.from(
        currentIed.querySelectorAll(':scope LN > Inputs, :scope LN0 > Inputs')
      ).forEach(inputSection => {
        const storedInputSection: storedInput = {
          id: `${identity(inputSection.parentElement)}`,
          input: <Element>this.doc.importNode(inputSection, true),
        };

        if (inputsSections.has(currentIedName!)) {
          inputsSections.get(currentIedName)!.push(storedInputSection);
        } else {
          inputsSections.set(currentIedName!, [storedInputSection]);
        }
      });

      Array.from(
        currentIed.querySelectorAll(':scope LN0 > GSEControl')
      ).forEach(gseControl => {
        const storedGSEControl: storedInput = {
          id: `${identity(gseControl.parentElement)}`,
          input: <Element>this.doc.importNode(gseControl, true),
        };

        if (gseControlSections.has(currentIedName!)) {
          gseControlSections.get(currentIedName)!.push(storedGSEControl);
        } else {
          gseControlSections.set(currentIedName!, [storedGSEControl]);
        }
      });
    });

    selected.forEach(iedListItem => {
      const { id } = iedListItem!.dataset;
      const currentIed = this.doc.querySelector(selector('IED', id!))!;
      const currentIedName = currentIed.getAttribute('name')!;

      const editActions: (Remove | Insert)[] = [];

      const newIed = <Element>this.selectedIed?.cloneNode(true);
      newIed.setAttribute('name', currentIedName);

      const removeIed: Remove = { node: currentIed };
      editActions.push(removeIed);

      const insertIed: Insert = {
        parent: this.doc.documentElement,
        node: newIed,
        reference: currentIed.previousElementSibling,
      };
      editActions.push(insertIed);
      this.dispatchEvent(newEditEvent(editActions));

      const inputActions: (Remove | Insert)[] = [];

      // remove and replace input sections
      inputsSections.get(currentIedName)!.forEach(transferInput => {
        // eslint-disable-next-line no-shadow
        const { id, input } = transferInput;
        const lN =
          this.doc.querySelector(selector('LN', <string>id)) ??
          this.doc.querySelector(selector('LN0', <string>id));
        if (lN) {
          inputActions.push({
            node: lN.querySelector('Inputs')!,
          });
          inputActions.push({
            parent: <Element>lN,
            node: input,
            reference: lN.querySelector('Inputs')!.nextElementSibling,
          });
        }
      });

      const gseControls = currentIed.querySelectorAll('GSEControl');

      let lastGse: Element;

      if (gseControls)
        Array.from(gseControls).forEach(gseControl => {
          inputActions.push({
            node: gseControl!,
          });
          lastGse = gseControl;
        });

      gseControlSections.get(currentIedName)!.forEach(transferInput => {
        // eslint-disable-next-line no-shadow
        const { id, input } = transferInput;

        inputActions.push({
          parent: <Element>this.doc.querySelector(selector('LN0', id)),
          node: input,
          reference: lastGse.nextElementSibling,
        });
      });

      this.dispatchEvent(newEditEvent(inputActions));
    });
  }

  private renderIedSelector(): TemplateResult {
    return html`<div id="iedSelector">
      <oscd-filter-button
        id="iedFilter"
        icon="developer_board"
        header="IED Selector"
        @selected-items-changed="${(e: SelectedItemsChangedEvent) => {
          this.selectedIEDs = e.detail.selectedItems;
          this.requestUpdate('selectedIed');
        }}"
      >
        ${this.iedList.map(ied => {
          const name = getNameAttribute(ied) ?? 'Unknown Name';
          const descr = getDescriptionAttribute(ied);
          const type = ied.getAttribute('type');
          const manufacturer = ied.getAttribute('manufacturer');
          return html` <mwc-radio-list-item
            value="${name}"
            ?twoline="${!!(type && manufacturer)}"
            ?selected="${this.selectedIEDs?.includes(name ?? '')}"
          >
            ${name} ${descr ? html` (${descr})` : html``}
            <span slot="secondary">
              ${type} ${type && manufacturer ? html`&mdash;` : nothing}
              ${manufacturer}
            </span>
          </mwc-radio-list-item>`;
        })}
      </oscd-filter-button>
      <h2>
        ${this.selectedIed
          ? getNameAttribute(this.selectedIed)
          : 'No IED Selected'}
        (${this.selectedIed?.getAttribute('type') ?? 'Unknown Type'})
      </h2>
    </div>`;
  }

  render(): TemplateResult {
    if (!this.doc) return html``;
    return html`<mwc-dialog id="dialog" heading="${msg('Replace IEDs')}">
      <p>
        ${msg(
          'This plugin replaces IEDs with a template, transferring ExtRef elements.'
        )}
        ${msg('It assumes the data models are compatible.')}
      </p>
      ${this.renderIedSelector()}
      <oscd-filtered-list id="replaceIeds" multi>
        ${Array.from(this.doc.querySelectorAll('IED'))
          .filter(
            candidateIed =>
              candidateIed.getAttribute('name') !==
              this.selectedIed?.getAttribute('name')
          )
          .map(
            ied => html`<mwc-check-list-item data-id="${identity(ied)}">
              ${ied.getAttribute('name')}</mwc-check-list-item
            >`
          )}
      </oscd-filtered-list>
      <mwc-button
        label="${msg('Close')}"
        slot="secondaryAction"
        icon="close"
        @click="${() => {
          this.dialogUI?.close();
        }}"
      ></mwc-button>
      <mwc-button
        label="${msg('Apply')}"
        slot="primaryAction"
        ?disabled=${!this.selectedIed}
        icon="start"
        @click="${() => {
          this.replaceIeds();
          this.dialogUI?.close();
        }}"
      ></mwc-button>
    </mwc-dialog>`;
  }

  static styles = css`
    :host {
      width: 100vw;
      height: 100vh;
    }

    #iedSelector {
      display: flex;
    }

    h1,
    h2,
    h3 {
      color: var(--mdc-theme-on-surface);
      font-family: 'Roboto', sans-serif;
      font-weight: 300;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin: 0px;
      line-height: 48px;
      padding-left: 0.3em;
      transition: background-color 150ms linear;
    }
  `;
}
