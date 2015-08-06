package com.psddev.cms.tool.dom;

import java.util.List;

public class ContainerElement extends AbstractElement {

    private List<? extends AbstractElement> elements;

    public List<? extends AbstractElement> getElements() {
        return elements;
    }

    public void setElements(List<? extends AbstractElement> elements) {
        this.elements = elements;
    }

    @Override
    public String getTemplate() {
        return "tool/dom/container-element";
    }
}
