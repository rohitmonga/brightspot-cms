package com.psddev.cms.tool.page.model;

public interface PageModel {

    String RESOURCE_PATH_PREFIX = "tool/page/model";

    default String getTemplatePath() {
        return RESOURCE_PATH_PREFIX + getClass().getSimpleName();
    }
}
