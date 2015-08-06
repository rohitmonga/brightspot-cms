package com.psddev.cms.tool.dom;

import java.util.Map;

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

    public static ContentElement build(String type, String content) {

        return (ContentElement) ElementBuilder.newBuilder(ContentElement.class)
                .type(type)
                .content(content)
                .get();
    }

    public static ContentElement build(String type, Map<String, Object> attributes, String content) {

        return (ContentElement) ElementBuilder.newBuilder(ContentElement.class)
                .type(type)
                .attributes(attributes)
                .content(content)
                .get();
    }
}
