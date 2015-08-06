package com.psddev.cms.tool.dom;

import java.util.Map;

public class VoidElement extends AbstractElement {

    @Override
    public String getTemplate() {
        return "tool/dom/void-element";
    }

    public static VoidElement build(String type, Map<String, Object> attributes) {
        return (VoidElement) ElementBuilder.newBuilder(VoidElement.class)
                .type(type)
                .attributes(attributes)
                .get();
    }
}
