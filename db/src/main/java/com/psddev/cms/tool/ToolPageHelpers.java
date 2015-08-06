package com.psddev.cms.tool;

import java.io.IOException;
import java.util.Map;
import java.util.stream.Collectors;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.psddev.cms.tool.dom.AbstractElement;

public class ToolPageHelpers {

    private static Handlebars getHandlebars() {
        Handlebars handlebars = new Handlebars();
        handlebars.registerHelpers(ToolPageHelpers.class);
        return handlebars;
    }

    public static CharSequence el(AbstractElement element) throws IOException {
        return render(element.getTemplate(), element);
    }

    public static CharSequence render(String resourcePath, Object object) throws IOException {
        Handlebars handlebars = getHandlebars();
        Template template = handlebars.compile(resourcePath);
        return new Handlebars.SafeString(template.apply(object));
    }

    public static CharSequence attrs(Map<String, Object> map) throws IOException {
        return new Handlebars.SafeString(map.entrySet().stream()
                .map((e) -> e.getKey() != null && e.getValue() != null
                        ? String.format("%s=\"%s\"", e.getKey(), e.getValue())
                        : "")
                .collect(Collectors.joining(" ")));
    }
}
