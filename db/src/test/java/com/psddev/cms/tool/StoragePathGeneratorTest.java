package com.psddev.cms.tool;

import com.psddev.cms.db.ToolUi;
import com.psddev.cms.tool.page.StorageItemField;
import com.psddev.dari.db.Database;
import com.psddev.dari.db.Record;
import com.psddev.dari.util.StorageItem;
import com.psddev.dari.util.StringUtils;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertEquals;

import com.psddev.dari.test.TestDatabase;
import com.psddev.dari.test.DatabaseTestUtils;

public class StoragePathGeneratorTest {

    private static final String TEST_FILENAME = "testing.mp5";
    private static final String TEST_FILENAME_SUFFIX = "mp5";
    private static final String DEFAULT_PATH_PREFIX_REGEX = "\\p{XDigit}{2}/\\p{XDigit}{2}/\\p{XDigit}{28}";
    private static final Pattern DEFAULT_PATH_PREFIX_PATTERN_EMPTY_FILENAME = Pattern.compile(DEFAULT_PATH_PREFIX_REGEX + "/\\p{XDigit}{32}");
    private static final Pattern DEFAULT_PATH_PATTERN_WITH_FILENAME = Pattern.compile(DEFAULT_PATH_PREFIX_REGEX + "/" + TEST_FILENAME);

    private static List<TestDatabase> TEST_DATABASES;
    private static List<Database> DATABASES;

    @BeforeClass
    public static void beforeClass() {

        TEST_DATABASES = DatabaseTestUtils.getNewDefaultTestDatabaseInstances();
        DATABASES = new ArrayList<>();

        for (TestDatabase testDb : TEST_DATABASES) {
            Database db = testDb.get();
            DATABASES.add(db);
        }

        if (DATABASES.size() == 0) {
            throw new IllegalStateException("No databases are defined for testing!");
        }
    }

    @AfterClass
    public static void afterClass() {
        if (TEST_DATABASES != null) for (TestDatabase testDb : TEST_DATABASES) {
            testDb.close();
        }
    }

    @Before
    public void before() {

    }

    @After
    public void after() {

    }

    @Test
    public void reverse_compatible_default_path_prefix() {

        String oldPath = StorageItemField.createStorageItemPath(null, null);

        String newPath = StorageItemField.getStoragePath(Optional.empty());

        assertTrue(DEFAULT_PATH_PREFIX_PATTERN_EMPTY_FILENAME.matcher(oldPath).matches());
        assertTrue(DEFAULT_PATH_PREFIX_PATTERN_EMPTY_FILENAME.matcher(newPath).matches());
    }

    @Test
    public void reverse_compatible_default_path() {

        String oldPath = StorageItemField.createStorageItemPath(null, TEST_FILENAME);

        String newPath = new ToolUi.StoragePathGenerator() { }.generate(null, TEST_FILENAME);

        assertTrue(DEFAULT_PATH_PATTERN_WITH_FILENAME.matcher(oldPath).matches());

        assertTrue(DEFAULT_PATH_PATTERN_WITH_FILENAME.matcher(newPath).matches());
    }

    @Test
    public void reverse_compatible_path_IC() {

        for (Database database : DATABASES) {

            Database.Static.overrideDefault(database);

            String title = "Title Number One";

            Pattern testPathPattern = Pattern.compile(DEFAULT_PATH_PREFIX_REGEX + "/" + StringUtils.toNormalized(title) + "." + TEST_FILENAME_SUFFIX);

            TestRecord one = TestRecord.getInstance(database);
            one.setTitle(title);

            String oldPath = StorageItemField.createStorageItemPath(one.getLabel(), TEST_FILENAME);

            String newPath = new ToolUi.StoragePathGenerator() { }.generate(one, TEST_FILENAME);

            assertTrue(testPathPattern.matcher(oldPath).matches());

            assertTrue(testPathPattern.matcher(newPath).matches());

            Database.Static.restoreDefault();
        }
    }

    /** Test Record type for StorageItemPathGenerator reverse-compatibility tests **/
    public static class TestRecord extends Record {

        public static TestRecord getInstance(Database database) {

            TestRecord object = new TestRecord();
            object.getState().setDatabase(database);
            return object;
        }

        private String title;

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        private StorageItem storageItem;

        public StorageItem getStorageItem() {
            return storageItem;
        }

        public void setStorageItem(StorageItem storageItem) {
            this.storageItem = storageItem;
        }

        @Override
        public String getLabel() {
            return title;
        }
    }
}
