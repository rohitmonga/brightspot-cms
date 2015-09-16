package com.psddev.cms.tool.search;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.psddev.cms.tool.CmsTool;
import com.psddev.cms.tool.Search;
import com.psddev.cms.tool.SearchResultAction;
import com.psddev.cms.tool.SearchResultSelection;
import com.psddev.cms.tool.SearchResultSelectionItem;
import com.psddev.cms.tool.ToolPageContext;
import com.psddev.dari.db.ObjectType;
import com.psddev.dari.db.Query;
import com.psddev.dari.db.State;
import com.psddev.dari.util.UrlBuilder;

public class BulkEditSearchResultAction implements SearchResultAction {

    @Override
    public void writeHtml(
            ToolPageContext page,
            Search search,
            SearchResultSelection selection)
            throws IOException {

        UUID typeId = null;
        UUID selectionId = null;

        if (selection != null) {
            Set<UUID> itemIds = new HashSet<>();

            for (SearchResultSelectionItem item : Query
                    .from(SearchResultSelectionItem.class)
                    .where("selectionId = ?", selection.getId())
                    .selectAll()) {

                itemIds.add(item.getItemId());
            }

            Set<UUID> itemTypeIds = new HashSet<>();

            for (Object item : Query
                    .fromAll()
                    .where("_id = ?", itemIds)
                    .selectAll()) {

                itemTypeIds.add(State.getInstance(item).getTypeId());
            }

            if (itemTypeIds.size() != 1) {
                return;

            } else {
                typeId = itemTypeIds.iterator().next();
                selectionId = selection.getId();
            }

        } else if (search != null) {
            ObjectType type = search.getSelectedType();

            if (type == null || type.isAbstract()) {
                return;

            } else {
                typeId = type.getId();
            }
        }

        String typePermissionId = "type/" + typeId;

        // Do not allow editing of types for which the user does not have Bulk Edit permission
        if (!page.hasPermission(typePermissionId + "/bulkEdit")
                || !page.hasPermission(typePermissionId + "/write")) {
            return;
        }

        page.writeStart("div", "class", "searchResult-action-simple");
            page.writeStart("a",
                    "class", "button",
                    "target", "_top",
                    "href", new UrlBuilder(page.getRequest())
                            .absolutePath(page.toolPath(CmsTool.class, "/contentEditBulk"))
                            .currentParameters()
                            .parameter("typeId", typeId)
                            .parameter("selectionId", selectionId));
                if (selection != null) {
                    page.writeHtml(page.localize(BulkEditSearchResultAction.class, "action.editSelected"));
                } else {
                    page.writeHtml(page.localize(BulkEditSearchResultAction.class, "action.editAll"));
                }
            page.writeEnd();
        page.writeEnd();
    }
}
