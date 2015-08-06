package com.psddev.cms.tool.dom;

import java.util.Map;

import com.psddev.dari.util.CompactMap;

public abstract class AbstractElement {

    private String type;
    private Map<String, Object> attributes;

    public abstract String getTemplate();

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Map<String, Object> getAttributes() {
        if (attributes == null) {
            attributes = new CompactMap<>();
        }
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    public void putAttribute(String key, Object value) {
        getAttributes().put(key, value);
    }

}
