package com.psddev.cms.tool.dom;

public class ContentElement extends AbstractElement {

    private String content;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    @Override
    public String getTemplate() {
        return "tool/dom/content-element";
    }
}
