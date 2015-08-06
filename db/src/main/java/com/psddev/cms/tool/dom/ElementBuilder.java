package com.psddev.cms.tool.dom;

import java.util.List;
import java.util.Map;

public class ElementBuilder<T extends AbstractElement> {

    private T element;

    private ElementBuilder(Class<T> clazz) {
        try {
            this.element = clazz.newInstance();
        } catch(Exception e) {
            // ignore
        }
    }

    public ElementBuilder<T> type(String t) {
        element.setType(t);
        return this;
    }

    public ElementBuilder<T> attributes(Map<String, Object> attributes) {
        element.setAttributes(attributes);
        return this;
    }

    public ElementBuilder<T> content(String content) {
        if (element instanceof ContentElement) {
            ((ContentElement) element).setContent(content);
        }

        return this;
    }

    public ElementBuilder<T> children(List<AbstractElement> children) {
        if (element instanceof ContainerElement) {
            ((ContainerElement) element).setChildren(children);
        }

        return this;
    }

    public T get() {
        return element;
    }

    public static ElementBuilder newBuilder(Class<? extends AbstractElement> clazz) {
        return new ElementBuilder<>(clazz);
    }
}
