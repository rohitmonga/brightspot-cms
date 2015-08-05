package com.psddev.cms.tool;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.github.jknack.handlebars.Context;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.context.FieldValueResolver;
import com.psddev.cms.tool.dom.AbstractElement;
import com.psddev.dari.db.ObjectType;

public class ToolPageHelpers {

    private static Handlebars getHandlebars() {
        Handlebars handlebars = new Handlebars();
        handlebars.registerHelpers(ToolPageHelpers.class);
        return handlebars;
    }

    public static String render(String resourcePath, Object object) throws IOException {
        Handlebars handlebars = getHandlebars();
        Template template = handlebars.compile(resourcePath);
        return template.apply(object);
    }
}
