package com.psddev.cms.tool.page;

import com.psddev.cms.db.Site;
import com.psddev.cms.db.ToolUser;
import com.psddev.cms.tool.PageServlet;
import com.psddev.cms.tool.ToolPageContext;
import com.psddev.dari.db.Query;
import com.psddev.dari.util.JspUtils;
import com.psddev.dari.util.RoutingFilter;

import javax.servlet.ServletException;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RoutingFilter.Path(application = "cms", value = "/siteSwitch")
public class SiteSwitch extends PageServlet {

    @Override
    protected String getPermissionId() {
        return null;
    }

    @Override
    protected void doService(ToolPageContext page) throws IOException, ServletException {

        ToolUser user = page.getUser();

        if (page.param(boolean.class, "switch")) {

            user.setCurrentSite(Query.from(Site.class).where("_id = ?", page.param(UUID.class, "id")).first());
            user.save();
            JspUtils.redirect(page.getRequest(), page.getResponse(), page.cmsUrl("/"));
            return;
        }

        page.writeHeader();

        if (Query.from(Site.class).hasMoreThan(0)) {
            Site currentSite = user.getCurrentSite();

            List<Site> sites = user.findOtherAccessibleSites();

            // Only render the control if there is at least one Site to which the ToolUser can change
            // Case 1: ToolUser has access to at least one other Site (not including Global)
            // Case 2: ToolUser has access to at least one Site and the Global Site
            if (!sites.isEmpty() || (currentSite != null && page.hasPermission("site/global"))) {

                page.writeStart("div", "class", "widget");
                    page.writeStart("h1");
                        page.writeHtml(page.localize(SiteSwitch.class, "title"));
                    page.writeEnd();

                    page.writeStart("div", "class", "siteSwitch-content fixedScrollable");
                        page.writeStart("ul", "class", "links");
                            if (currentSite != null && page.hasPermission("site/global")) {
                                page.writeStart("li");
                                    page.writeStart("a",
                                            "href", page.cmsUrl("/siteSwitch", "switch", true),
                                            "target", "_top");
                                        page.writeHtml(page.localize(SiteSwitch.class, "label.global"));
                                    page.writeEnd();
                                page.writeEnd();
                            }

                            for (Site site : sites) {
                                page.writeStart("li");
                                    page.writeStart("a",
                                            "href", page.cmsUrl("/siteSwitch", "switch", true, "id", site.getId()),
                                            "target", "_top");
                                        page.writeObjectLabel(site);
                                    page.writeEnd();
                                page.writeEnd();
                            }
                        page.writeEnd();
                    page.writeEnd();
                page.writeEnd();
            }
        }
        page.writeFooter();
    }
}
