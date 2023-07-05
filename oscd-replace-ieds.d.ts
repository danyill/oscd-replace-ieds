import { LitElement, TemplateResult } from 'lit';
import '@material/mwc-button';
import '@material/mwc-formfield';
import '@material/mwc-list';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-list/mwc-radio-list-item';
import '@material/mwc-icon-button';
import './foundation/components/oscd-filter-button.js';
import './foundation/components/oscd-filtered-list.js';
import type { Dialog } from '@material/mwc-dialog';
import type { OscdFilteredList } from './foundation/components/oscd-filtered-list.js';
export default class ReplaceIEDs extends LitElement {
    /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
    doc: XMLDocument;
    docName: string;
    private get iedList();
    selectedIEDs: string[];
    private get selectedIed();
    dialogUI?: Dialog;
    replaceIedsUI?: OscdFilteredList;
    run(): Promise<void>;
    private replaceIeds;
    private renderIedSelector;
    render(): TemplateResult;
    static styles: import("lit").CSSResult;
}
