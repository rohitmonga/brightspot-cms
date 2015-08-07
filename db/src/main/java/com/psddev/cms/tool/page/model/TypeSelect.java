package com.psddev.cms.tool.page.model;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class TypeSelect implements PageModel {

    private boolean multiple;
    private Map<String, Object> attributes;
    private Collection<TypeSelectValue> values;

    public boolean isMultiple() {
        return multiple;
    }

    public void setMultiple(boolean multiple) {
        this.multiple = multiple;
    }

    public Map<String, Object> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    public Collection<TypeSelectValue> getValues() {
        if (values == null) {
            values = new ArrayList<>();
        }
        return values;
    }

    public void setValues(Collection<TypeSelectValue> values) {
        this.values = values;
    }

    public abstract static class TypeSelectValue {
        private String label;

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }
    }

    public static class TypeSelectOptionGroup extends TypeSelectValue implements PageModel {
        private List<TypeSelectOption> options;

        public List<TypeSelectOption> getOptions() {
            return options;
        }

        public void setOptions(List<TypeSelectOption> options) {
            this.options = options;
        }
    }

    public static class TypeSelectOption extends TypeSelectValue implements PageModel {
        private UUID value;
        private boolean selected;

        public UUID getValue() {
            return value;
        }

        public void setValue(UUID value) {
            this.value = value;
        }

        public boolean isSelected() {
            return selected;
        }

        public void setSelected(boolean selected) {
            this.selected = selected;
        }
    }
}
