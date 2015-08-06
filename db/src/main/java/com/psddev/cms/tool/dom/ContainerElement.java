package com.psddev.cms.tool.dom;

import java.util.List;
import java.util.Map;

public class ContainerElement extends AbstractElement {

    private List<? extends AbstractElement> children;

    public List<? extends AbstractElement> getChildren() {
        return children;
    }

    public void setChildren(List<? extends AbstractElement> children) {
        this.children = children;
    }

    @Override
    public String getTemplate() {
        return "tool/dom/container-element";
    }

    public static ContainerElement build(String type,
                                         Map<String, Object> attributes,
                                         List<? extends AbstractElement> children) {

        return (ContainerElement) ElementBuilder.newBuilder(ContainerElement.class)
                .type(type)
                .attributes(attributes)
                .children(children)
                .get();
    }
}
